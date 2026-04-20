import type { Request, Response } from 'express';
import { getDb } from '../../../../sqlite-db';
import { generateQuotationPdf, type QuotationPdfData } from '../../../../pdf-generator';
import type { ExpressApp, QuotationRepository, RegisterQuotationSubrouteDeps } from './types';

type RegisterQuotationPdfRoutesParams = {
  app: ExpressApp;
  deps: RegisterQuotationSubrouteDeps;
  quotationRepository: QuotationRepository;
};

function getLinePricing(item: any) {
  const quantity = Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 1;
  const unitPrice = Number.isFinite(Number(item?.unitPrice)) ? Number(item.unitPrice) : 0;
  const vatRate = Number.isFinite(Number(item?.vatRate)) ? Number(item.vatRate) : 0;
  const amount = quantity * unitPrice;
  if (String(item?.vatMode || '').toLowerCase() === 'gross') {
    const netTotal = amount / (1 + vatRate / 100);
    return {
      netTotal,
      vatTotal: amount - netTotal,
      grossTotal: amount,
    };
  }
  return {
    netTotal: amount,
    vatTotal: amount * (vatRate / 100),
    grossTotal: amount * (1 + vatRate / 100),
  };
}

function mapPdfLineItem(item: any, idx: number) {
  const pricing = getLinePricing(item);
  const commodity = (item.name || 'Unknown Item') + (item.technicalSpecs ? '\n' + item.technicalSpecs : '');
  return {
    no: idx + 1,
    code: item.sku || '-',
    commodity,
    unit: item.unit || 'Chiếc',
    qty: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    amount: pricing.grossTotal,
    remarks: item.remarks || '',
  };
}

export function registerQuotationPdfRoutes(params: RegisterQuotationPdfRoutesParams) {
  const { app, deps, quotationRepository } = params;
  const { ah } = deps;

  app.get('/api/quotations/:id/pdf', ah(async (req: Request, res: Response) => {
    const quotationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const db = getDb();
    const q = await quotationRepository.findPdfPayloadById(quotationId);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    const contact = q.contactId
      ? await db.get('SELECT * FROM Contact WHERE id = ?', q.contactId)
      : await db.get('SELECT * FROM Contact WHERE accountId = ? AND isPrimaryContact = 1', q.accountId)
        || await db.get('SELECT * FROM Contact WHERE accountId = ?', q.accountId);

    const lineItems = Array.isArray(q.lineItems) ? q.lineItems : [];
    const offerGroups = Array.isArray(q.offerGroups) ? q.offerGroups : [];
    const pdfOfferGroups = offerGroups.map((group: any) => {
      const groupLineItems = lineItems.filter((item: any) => String(item.offerGroupKey || 'group-a') === String(group.groupKey));
      const summary = groupLineItems.reduce(
        (acc: any, item: any) => {
          const pricing = getLinePricing(item);
          return {
            netSubtotal: acc.netSubtotal + pricing.netTotal,
            vatTotal: acc.vatTotal + pricing.vatTotal,
            grossTotal: acc.grossTotal + pricing.grossTotal,
          };
        },
        { netSubtotal: 0, vatTotal: 0, grossTotal: 0 },
      );
      return {
        label: group.label || null,
        currency: group.currency || q.currency || 'VND',
        totalComputed: group.totalComputed === true,
        items: groupLineItems.map(mapPdfLineItem),
        summary,
      };
    });

    const pdfData: QuotationPdfData = {
      quoteNumber: q.quoteNumber,
      subject: q.subject || 'Báo giá thiết bị HT Group',
      date: q.quoteDate ? new Date(q.quoteDate).toLocaleDateString('vi-VN') : (q.createdAt ? new Date(q.createdAt).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')),
      customer: {
        name: q.companyName || 'N/A',
        address: q.address || 'N/A',
        taxCode: q.taxCode || 'N/A',
        contact: contact ? (`${contact.lastName || ''} ${contact.firstName || ''}`.trim() || 'N/A') : 'N/A',
        phone: contact?.phone || 'N/A',
      },
      salesPerson: q.salesperson || 'Huynh Thy Sales Team',
      salesPersonPhone: q.salespersonPhone || '1900 9696 64',
      currency: q.currency || 'VND',
      items: lineItems.map(mapPdfLineItem),
      offerGroups: pdfOfferGroups.length ? pdfOfferGroups : undefined,
      subtotal: q.subtotal || 0,
      taxTotal: q.taxTotal || 0,
      grandTotal: q.grandTotal || 0,
      terms: q.pdfTerms,
    };

    const pdfBytes = await generateQuotationPdf(pdfData).catch((err) => {
      console.error('PDF Generation Error:', err);
      throw new Error('Failed to generate PDF: ' + err.message);
    });

    const safeFileName = q.quoteNumber.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Quotation_${safeFileName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  }));
}
