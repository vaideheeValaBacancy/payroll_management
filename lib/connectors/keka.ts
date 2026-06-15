/**
 * KEKA HRMS Connector
 *
 * POC status: STUB — data is seeded directly into Firestore.
 *
 * To activate Keka integration:
 *   1. Set KEKA_API_KEY and KEKA_ORG_ID in .env.local
 *   2. Replace stub methods with real Keka REST API calls:
 *      Base URL: https://{org}.keka.com/api/v1/hris/
 *      Auth: Bearer token via POST /token with client_credentials
 *   3. Map Keka employee response to the app's Employee interface
 *   4. Wire createConnector("keka") into the seed/ingestion pipeline
 *
 * Keka API Docs: https://developers.keka.com/
 */

import type { Employee } from "@/types";

export class KekaConnector {
  private apiKey: string;
  private orgId: string;

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  /**
   * Fetch all employees from Keka HRMS.
   *
   * Real implementation would call:
   *   GET https://{orgId}.keka.com/api/v1/hris/employees
   *   Headers: { Authorization: `Bearer ${this.apiKey}` }
   *
   * Response shape (Keka):
   *   { data: [{ id, firstName, lastName, email, designation, department,
   *              employmentDetails: { joiningDate, employmentType },
   *              compensation: { ctc } }] }
   *
   * Map to Employee interface before returning.
   */
  async getEmployees(): Promise<Employee[]> {
    throw new Error(
      "Keka connector: call authenticate() first or use seed data for POC"
    );
  }

  /**
   * Fetch and sync a single employee record by Keka employee ID.
   *
   * Real implementation would call:
   *   GET https://{orgId}.keka.com/api/v1/hris/employees/{empId}
   *   Headers: { Authorization: `Bearer ${this.apiKey}` }
   *
   * Map the Keka response to the app's Employee interface before returning.
   */
  async syncEmployee(empId: string): Promise<Employee> {
    throw new Error(
      "Keka connector: call authenticate() first or use seed data for POC"
    );
  }

  /**
   * Fetch attendance summary for an employee for a given month.
   *
   * Real implementation would call:
   *   GET https://{orgId}.keka.com/api/v1/hris/attendance?employeeId={empId}&month={month}
   *   Headers: { Authorization: `Bearer ${this.apiKey}` }
   *   month format: "YYYY-MM"
   *
   * Response shape (Keka):
   *   { data: { presentDays, lopDays, totalWorkingDays } }
   */
  async getAttendance(
    empId: string,
    month: string
  ): Promise<{ workingDays: number; lopDays: number }> {
    throw new Error(
      "Keka connector: call authenticate() first or use seed data for POC"
    );
  }
}

/**
 * Factory function to obtain a data source connector.
 *
 * "keka"   — returns a KekaConnector configured from environment variables.
 * "seed"   — returns null; the caller should read directly from Firestore seed data.
 * "manual" — returns null; the caller should read directly from Firestore manual entries.
 */
export function createConnector(
  source: "keka" | "seed" | "manual"
): KekaConnector | null {
  if (source === "keka") {
    return new KekaConnector(
      process.env.KEKA_API_KEY ?? "",
      process.env.KEKA_ORG_ID ?? ""
    );
  }
  // "seed" and "manual" use Firestore directly — no connector needed
  return null;
}
