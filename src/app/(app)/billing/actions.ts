"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { invoiceTotals, paidStatus, parseRM, formatRM } from "@/lib/money";
import { nextSequence, pad } from "@/lib/sequence";
import { mytDate } from "@/lib/time";
import { redirectWith } from "@/lib/flash";

const METHODS: PaymentMethod[] = ["CASH", "CARD", "FPX", "DUITNOW", "EWALLET"];

async function recalc(tx: Prisma.TransactionClient, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  const t = invoiceTotals(inv.items, inv.discountSen);
  await tx.invoice.update({ where: { id: invoiceId }, data: t });
}

async function loadDraft(invoiceId: string, branchId: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, branchId } });
  if (!inv) redirectWith("/billing", "error", "Invoice not found at this branch");
  if (inv.status !== "DRAFT") redirectWith(`/billing/${invoiceId}`, "error", "Only draft invoices can be changed");
  return inv;
}

export async function createInvoice(form: FormData) {
  const user = await requireUser("billing.write");
  const patientId = String(form.get("patientId") ?? "");
  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) redirectWith("/billing", "error", "Patient not found");

  const inv = await db.$transaction(async (tx) => {
    const i = await tx.invoice.create({ data: { branchId: user.branch.id, patientId, createdById: user.id } });
    await audit({ user, action: "CREATE", entity: "Invoice", entityId: i.id }, tx);
    return i;
  });
  redirect(`/billing/${inv.id}`);
}

export async function addItem(form: FormData) {
  const user = await requireUser("billing.write");
  const invoiceId = String(form.get("invoiceId") ?? "");
  await loadDraft(invoiceId, user.branch.id);
  const back = `/billing/${invoiceId}`;

  const qty = Number(form.get("qty") ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) redirectWith(back, "error", "Quantity must be 1 to 999");

  const serviceId = String(form.get("serviceId") ?? "");
  let description: string;
  let unitPriceSen: number;
  if (serviceId) {
    const svc = await db.service.findFirst({ where: { id: serviceId, active: true } });
    if (!svc) redirectWith(back, "error", "Service not found");
    description = svc.name;
    unitPriceSen = svc.priceSen;
  } else {
    description = String(form.get("description") ?? "").trim();
    const price = parseRM(String(form.get("price") ?? ""));
    if (!description) redirectWith(back, "error", "Enter a description or pick a service");
    if (price === null) redirectWith(back, "error", "Enter a valid price, e.g. 45.00");
    unitPriceSen = price;
  }

  await db.$transaction(async (tx) => {
    await tx.invoiceItem.create({
      data: { invoiceId, serviceId: serviceId || null, description, qty, unitPriceSen, amountSen: qty * unitPriceSen },
    });
    await recalc(tx, invoiceId);
    await audit({ user, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { addItem: description, qty } }, tx);
  });
  revalidatePath(back);
  redirect(back);
}

export async function removeItem(form: FormData) {
  const user = await requireUser("billing.write");
  const itemId = String(form.get("itemId") ?? "");
  const item = await db.invoiceItem.findUnique({ where: { id: itemId } });
  if (!item) redirectWith("/billing", "error", "Item not found");
  await loadDraft(item.invoiceId, user.branch.id);

  await db.$transaction(async (tx) => {
    await tx.invoiceItem.delete({ where: { id: itemId } });
    await recalc(tx, item.invoiceId);
    await audit({ user, action: "UPDATE", entity: "Invoice", entityId: item.invoiceId, details: { removeItem: item.description } }, tx);
  });
  redirect(`/billing/${item.invoiceId}`);
}

export async function setDiscount(form: FormData) {
  const user = await requireUser("billing.write");
  const invoiceId = String(form.get("invoiceId") ?? "");
  await loadDraft(invoiceId, user.branch.id);
  const back = `/billing/${invoiceId}`;
  const sen = parseRM(String(form.get("discount") ?? "0") || "0");
  if (sen === null) redirectWith(back, "error", "Enter a valid discount, e.g. 10.00");

  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { discountSen: sen } });
    await recalc(tx, invoiceId);
    await audit({ user, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { discountSen: sen } }, tx);
  });
  redirect(back);
}

export async function issueInvoice(form: FormData) {
  const user = await requireUser("billing.write");
  const invoiceId = String(form.get("invoiceId") ?? "");
  const inv = await loadDraft(invoiceId, user.branch.id);
  const back = `/billing/${invoiceId}`;
  if (inv.totalSen <= 0) redirectWith(back, "error", "Add at least one item before issuing");

  const yyyymm = mytDate().slice(0, 7).replace("-", "");
  const issued = await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `inv:${user.branch.id}:${yyyymm}`);
    const invoiceNo = `${user.branch.code}-${yyyymm}-${pad(seq, 5)}`;
    const i = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "ISSUED", invoiceNo, issuedAt: new Date() } });
    await audit({ user, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { issued: invoiceNo, totalSen: i.totalSen } }, tx);
    return i;
  });
  revalidatePath("/billing");
  redirectWith(back, "ok", `Invoice ${issued.invoiceNo} issued`);
}

export async function addPayment(form: FormData) {
  const user = await requireUser("billing.write");
  const invoiceId = String(form.get("invoiceId") ?? "");
  const back = `/billing/${invoiceId}`;
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, branchId: user.branch.id } });
  if (!inv) redirectWith("/billing", "error", "Invoice not found at this branch");
  if (inv.status !== "ISSUED" && inv.status !== "PARTIALLY_PAID") redirectWith(back, "error", "Payments can only be taken on issued, unpaid invoices");

  const method = String(form.get("method") ?? "") as PaymentMethod;
  if (!METHODS.includes(method)) redirectWith(back, "error", "Pick a payment method");
  const amount = parseRM(String(form.get("amount") ?? ""));
  if (amount === null || amount <= 0) redirectWith(back, "error", "Enter a valid amount");
  const balance = inv.totalSen - inv.paidSen;
  if (amount > balance) redirectWith(back, "error", `Amount is more than the balance of ${formatRM(balance)}`);
  const reference = String(form.get("reference") ?? "").trim() || null;
  if (method !== "CASH" && !reference) redirectWith(back, "error", "Enter the reference / approval code for non-cash payments");

  const yyyymm = mytDate().slice(0, 7).replace("-", "");
  let receipt: string;
  try {
    receipt = await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `rcpt:${user.branch.id}:${yyyymm}`);
    const receiptNo = `R-${user.branch.code}-${yyyymm}-${pad(seq, 5)}`;
    const pay = await tx.payment.create({ data: { invoiceId, method, amountSen: amount, reference, receivedById: user.id, receiptNo } });
    // Re-read inside the transaction so two cashiers cannot overpay together.
    const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const paidSen = fresh.paidSen + amount;
    if (paidSen > fresh.totalSen) throw new Error("Overpayment");
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidSen, status: paidStatus(fresh.totalSen, paidSen) } });
    await audit({ user, action: "CREATE", entity: "Payment", entityId: pay.id, details: { invoiceId, method, amountSen: amount, receiptNo } }, tx);
    return receiptNo;
    }, { isolationLevel: "Serializable" });
  } catch {
    redirectWith(back, "error", "Payment not saved: the invoice changed at the same time. Check the balance and try again");
  }

  revalidatePath("/billing");
  redirectWith(back, "ok", `Payment received. Receipt ${receipt}`);
}

export async function voidInvoice(form: FormData) {
  const user = await requireUser("billing.void");
  const invoiceId = String(form.get("invoiceId") ?? "");
  const back = `/billing/${invoiceId}`;
  const reason = String(form.get("reason") ?? "").trim();
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, branchId: user.branch.id } });
  if (!inv) redirectWith("/billing", "error", "Invoice not found at this branch");
  if (inv.status === "VOID") redirectWith(back, "error", "Already void");
  if (inv.paidSen > 0) redirectWith(back, "error", "Invoice has payments. Refunds come in a later stage");
  if (reason.length < 3) redirectWith(back, "error", "Give a reason for voiding");

  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOID", voidedAt: new Date(), voidReason: reason } });
    await audit({ user, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { void: reason } }, tx);
  });
  revalidatePath("/billing");
  redirectWith(back, "ok", "Invoice voided");
}
