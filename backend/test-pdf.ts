import { generateQuotationPdf, QuotationPdfData } from './pdf-generator';
import fs from 'fs';

const mockData: QuotationPdfData = {
  quoteNumber: '059-26/BG/LD-PEQ-CHP',
  subject: 'Báo giá Xe nâng Container Reach Stacker và Phụ tùng bảo dưỡng',
  date: '22/03/2026',
  customer: {
    name: 'CÔNG TY TNHH CẢNG NAM HẢI ĐÌNH VŨ',
    address: 'Khu công nghiệp Đình Vũ, Phường Đông Hải 2, Quận Hải An, Thành phố Hải Phòng, Việt Nam',
    taxCode: '0200832363',
    contact: 'Mr. Nguyễn Văn Nam',
    phone: '0901234567',
  },
  salesPerson: 'Huỳnh Thy Ngọc',
  salesPersonPhone: '0911 000 001',
  currency: 'VND',
  items: [
    {
      no: 1,
      code: 'HNRS4531',
      commodity: 'Xe nâng container dầu - Diesel Reach Stacker\n- Nhãn hiệu: SOCMA, Xuất xứ: Trung Quốc\n- Model: HNRS4531, Tình trạng: Mới 100%\n- Tải trọng: 45T, 31T, 16T\n- Hộp số: DANA, Cầu xe: Kessler',
      unit: 'Chiếc',
      qty: 1,
      unitPrice: 12500000000,
      amount: 12500000000,
      remarks: 'Bảo hành 2 năm'
    },
    {
      no: 2,
      code: 'FILTER-SET',
      commodity: 'Bộ lọc bảo dưỡng định kỳ (Lọc dầu, Lọc gió, Lọc thủy lực)',
      unit: 'Bộ',
      qty: 5,
      unitPrice: 15000000,
      amount: 75000000,
      remarks: 'Giao kèm xe'
    }
  ],
  subtotal: 12575000000,
  taxTotal: 1006000000,
  grandTotal: 13581000000,
  terms: {
    validity: '30 ngày kể từ ngày báo giá',
    validityEn: '30 days from the date here of',
    payment: 'Thanh toán 30% khi ký hợp đồng, 70% còn lại trước khi giao hàng',
    paymentEn: '30% upon order, 70% balance before delivery',
    delivery: '4-6 tháng kể từ ngày ký hợp đồng',
    deliveryEn: '4-6 months from the date of signing the contract',
    warranty: 'Bảo hành theo tiêu chuẩn nhà sản xuất',
    warrantyEn: 'According to manufacturer standards',
    remarks: 'Giá trên đã bao gồm thuế VAT 8%.',
    remarksEn: 'The above price includes VAT 8%.',
  }
};

async function test() {
  try {
    console.log('Starting PDF generation test with Stitch Layout...');
    const pdfBytes = await generateQuotationPdf(mockData);
    const outName = `test_output_${Date.now()}.pdf`;
    fs.writeFileSync(outName, pdfBytes);
    console.log(`✅ PDF generated successfully: ${outName}`);
  } catch (err) {
    console.error('❌ PDF generation failed:', err);
  }
}

test();
