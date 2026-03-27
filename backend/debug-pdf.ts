import { initDb, getDb } from './sqlite-db';
import { generateQuotationPdf, QuotationPdfData } from './pdf-generator';
import fs from 'fs';

async function debug() {
  try {
    await initDb();
    const db = getDb();
    const q = await db.get('SELECT * FROM Quotation LIMIT 1');
    if (!q) {
      console.log('No quotations found in DB');
      return;
    }
    console.log('Testing PDF for Quote:', q.quoteNumber);
    
    const itemsParsed = JSON.parse(q.items || '[]');
    const terms = JSON.parse(q.terms || '{}');
    
    const data: QuotationPdfData = {
      quoteNumber: q.quoteNumber,
      subject: q.subject || 'Báo giá',
      date: '22/03/2026',
      customer: {
        name: 'Test Customer',
        address: 'Test Address',
        taxCode: '0123',
        contact: 'Mr. Test',
        phone: '0909'
      },
      salesPerson: q.salesperson || 'Sales',
      salesPersonPhone: q.salespersonPhone || '0909',
      currency: q.currency || 'VND',
      items: itemsParsed.map((item: any, idx: number) => ({
        no: idx + 1,
        code: item.sku || '-',
        commodity: (item.name || '') + (item.technicalSpecs ? '\n' + item.technicalSpecs : ''),
        unit: item.unit || 'Chiếc',
        qty: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: (item.quantity || 1) * (item.unitPrice || 0),
        remarks: item.remarks || ''
      })),
      subtotal: q.subtotal || 0,
      taxTotal: q.taxTotal || 0,
      grandTotal: q.grandTotal || 0,
      terms: {
        validity: terms.validity || '30 days',
        validityEn: terms.validityEn,
        payment: terms.payment || '30/70',
        paymentEn: terms.paymentEn,
        delivery: terms.delivery || '4-6 months',
        deliveryEn: terms.deliveryEn,
        warranty: terms.warranty || '12 months',
        warrantyEn: terms.warrantyEn,
        remarks: terms.remarks,
        remarksEn: terms.remarksEn
      }
    };

    const pdfBytes = await generateQuotationPdf(data);
    fs.writeFileSync('debug_output.pdf', pdfBytes);
    console.log('✅ Debug PDF generated successfully');
  } catch (err: any) {
    console.error('❌ Debug PDF generation failed:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

debug();
