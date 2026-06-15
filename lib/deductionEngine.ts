import type { IndianDeductions } from "@/types";

export function calculateDeductions(
  grossInr: number,
  earnings?: { basic: number; foodAllowance: number; fuelAllowance: number }
): IndianDeductions {
  const basic = earnings?.basic ?? parseFloat((grossInr * 0.40).toFixed(2));
  const foodAllowance = earnings?.foodAllowance ?? parseFloat((grossInr * 0.08).toFixed(2));
  const fuelAllowance = earnings?.fuelAllowance ?? parseFloat((grossInr * 0.07).toFixed(2));

  // PF employee capped at ₹1,800/month (statutory ceiling on ₹15,000 basic)
  const pfEmployee = parseFloat((Math.min(basic * 0.12, 1800)).toFixed(2));
  const pfEmployer = parseFloat((Math.min(basic * 0.12, 1800)).toFixed(2));
  const professionalTax = 200;
  const incomeTax = parseFloat((grossInr * 0.10).toFixed(2));
  const foodAllowanceDeduction = parseFloat(foodAllowance.toFixed(2));
  const fuelAllowanceDeduction = parseFloat(fuelAllowance.toFixed(2));

  return {
    pfEmployee,
    pfEmployer,
    professionalTax,
    incomeTax,
    foodAllowanceDeduction,
    fuelAllowanceDeduction,
  };
}

export function calculateNet(grossInr: number, deductions: IndianDeductions): number {
  const totalDeductions =
    deductions.pfEmployee +
    deductions.professionalTax +
    deductions.incomeTax +
    deductions.foodAllowanceDeduction +
    deductions.fuelAllowanceDeduction;
  return parseFloat((grossInr - totalDeductions).toFixed(2));
}
