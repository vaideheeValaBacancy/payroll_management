/**
 * Turns internal fraud-flag codes (e.g. "routing_number_changed_48h") into
 * plain-English explanations a non-technical reviewer can understand.
 * Used by the transaction drawer's "Why this was flagged" section.
 */
export function humanizeFlag(code: string): { title: string; detail: string } {
  // Dynamic flag: shared_routing_hash_<N>_employees
  const shared = code.match(/^shared_routing_hash_(\d+)_employees$/);
  if (shared) {
    const n = shared[1];
    return {
      title: `${n} employees share the same bank account`,
      detail: `This account is set to receive pay for ${n} different employees — a common sign of "ghost employees" or salaries being funnelled to one person.`,
    };
  }

  switch (code) {
    case "routing_number_changed_48h":
      return {
        title: "Bank details changed right before payday",
        detail: "This employee's bank account was changed within the last 48 hours — a classic move to divert someone's salary at the last minute.",
      };
    case "amount_exceeds_2.5x_median":
      return {
        title: "Payment far larger than usual",
        detail: "This payout is more than 2.5× this employee's normal pay, which can indicate an inflated or fraudulent amount.",
      };
    case "new_bank_account_detected":
      return {
        title: "Money going to a brand-new account",
        detail: "The destination bank account has never been used for this employee before.",
      };
    default:
      // Graceful fallback for any unmapped code
      return {
        title: code.replace(/_/g, " "),
        detail: "",
      };
  }
}
