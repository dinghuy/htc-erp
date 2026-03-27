import type { Express, Request, Response } from 'express';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterPlatformCalculatorRoutesDeps = {
  ah: AsyncRouteFactory;
};

export function registerPlatformCalculatorRoutes(app: Express, deps: RegisterPlatformCalculatorRoutesDeps) {
  const { ah } = deps;

  app.post('/api/calculate', ah(async (req: Request, res: Response) => {
    const {
      baseCostUSD,
      quantity = 1,
      exchangeRate = 25400,
      interestRate = 0.085,
      loanTermMonths = 36,
      loanRatio = 0.7,
      markup = 0.15,
      vatRate = 0.08,
      importTaxRate = 0,
      shippingCostUSD = 0,
    } = req.body;

    const landedCostUSD = (baseCostUSD + shippingCostUSD) * (1 + importTaxRate);
    const landedCostVND = landedCostUSD * exchangeRate;

    const loanAmountVND = landedCostVND * quantity * loanRatio;
    const monthlyRate = interestRate / 12;
    const financingCostVND = loanAmountVND * monthlyRate * loanTermMonths;

    const totalCostVND = landedCostVND * quantity + financingCostVND;
    const costPerUnitVND = totalCostVND / quantity;

    const sellingPriceVND = costPerUnitVND * (1 + markup);

    const vatAmountVND = sellingPriceVND * vatRate;
    const sellingPriceWithVAT = sellingPriceVND + vatAmountVND;

    const grandTotalVND = sellingPriceWithVAT * quantity;

    res.json({
      landedCostUSD: Math.round(landedCostUSD * 100) / 100,
      landedCostVND: Math.round(landedCostVND),
      financingCostVND: Math.round(financingCostVND),
      costPerUnitVND: Math.round(costPerUnitVND),
      sellingPriceVND: Math.round(sellingPriceVND),
      vatAmountVND: Math.round(vatAmountVND),
      sellingPriceWithVAT: Math.round(sellingPriceWithVAT),
      grandTotalVND: Math.round(grandTotalVND),
      breakdown: {
        'Giá vốn (USD)': `$${landedCostUSD.toFixed(2)}`,
        'Giá vốn (VND)': `${Math.round(landedCostVND).toLocaleString()} đ`,
        'Chi phí tài chính': `${Math.round(financingCostVND).toLocaleString()} đ`,
        'Giá bán (chưa VAT)': `${Math.round(sellingPriceVND).toLocaleString()} đ`,
        'VAT (8%)': `${Math.round(vatAmountVND).toLocaleString()} đ`,
        'Giá bán (có VAT)': `${Math.round(sellingPriceWithVAT).toLocaleString()} đ`,
      },
    });
  }));
}
