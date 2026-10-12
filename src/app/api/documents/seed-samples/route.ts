import { NextResponse } from "next/server";
import { createDocumentFromUpload } from "@/server/documents";
import { createSyntheticPdf } from "@/lib/test-fixtures/pdf-generator";

export async function POST() {
  try {
    // 1. Master Services Agreement (PDF)
    const msaPages = [
      `MASTER SERVICES AGREEMENT\n\nThis Master Services Agreement ("Agreement") is entered into as of January 15, 2024, by and between Apex Global Solutions LLC ("Provider") and Horizon Enterprises PJSC ("Customer").\n\n1. SCOPE OF SERVICES\n1.1 Provider shall perform the professional cloud consultancy and engineering services set forth in each agreed Statement of Work (SOW).\n1.2 Each SOW shall reference this Agreement and specify milestones, deliverables, and applicable acceptance criteria.`,
      `2. TERM AND TERMINATION\n2.1 Initial Term: This Agreement commences on the Effective Date and shall continue for an initial period of two (2) years.\n2.2 Termination for Convenience: Either party may terminate this Agreement or any active SOW at any time without cause upon giving at least thirty (30) days prior written notice to the other party.\n2.3 Termination for Cause: Either party may terminate immediately upon written notice if the other party commits a material breach and fails to cure such breach within fourteen (14) days.`,
      `3. FEES AND PAYMENT TERMS\n3.1 Consulting Fees: Customer shall pay Provider the aggregate contract amount of AED 250,000 for the initial milestone deliverables.\n3.2 Invoicing: Invoices shall be issued monthly. Customer shall pay all undisputed invoice amounts within thirty (30) days of the invoice date.\n3.3 Late Payments: Overdue balances shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by Applicable Law.`,
      `4. CONFIDENTIALITY AND INTELLECTUAL PROPERTY\n4.1 Confidential Information: Each party agrees to safeguard the disclosing party's proprietary information with the same degree of care it uses for its own confidential assets.\n4.2 Work Product: Provider assigns to Customer all right, title, and interest in deliverables specifically developed for Customer under an SOW.\n4.3 Governing Law: This Agreement shall be governed by and construed in accordance with the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates.`,
    ];
    const msaBuffer = createSyntheticPdf(msaPages);
    await createDocumentFromUpload("Master_Services_Agreement_2024.pdf", msaBuffer);

    // 2. Non-Disclosure Agreement (PDF)
    const ndaPages = [
      `MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis Mutual Non-Disclosure Agreement ("NDA") is made effective as of February 1, 2024.\n\n1. DEFINITION OF CONFIDENTIAL INFORMATION\n"Confidential Information" refers to any proprietary, technical, commercial, financial, or operational data disclosed by either party to the other, whether marked as confidential or reasonably understood to be confidential.`,
      `2. EXCLUSIONS AND NON-USE OBLIGATIONS\n2.1 Exclusions: Confidential Information does not include information that is publicly known, was already in the receiving party's possession without restriction, or is independently developed.\n2.2 Term of Protection: The duty to protect Confidential Information shall endure for a period of three (3) years from the date of disclosure.\n2.3 Return of Materials: Upon written request, all documents and electronic copies containing Confidential Information shall be promptly returned or securely certified destroyed.`,
    ];
    const ndaBuffer = createSyntheticPdf(ndaPages);
    await createDocumentFromUpload("Mutual_NDA_Standard.pdf", ndaBuffer);

    // 3. Amendment No 1 to Services Agreement (PDF) - planted changes for comparison!
    const amendmentPages = [
      `AMENDMENT NO. 1 TO MASTER SERVICES AGREEMENT\n\nThis Amendment No. 1 amends the Master Services Agreement dated January 15, 2024, between Apex Global Solutions LLC and Horizon Enterprises PJSC.\n\nRECITALS\nThe parties desire to modify the termination notice window and adjust the milestone contract fees as set forth below.\n\nAMENDMENTS\n1. Clause 2.2 is hereby amended: The notice period for Termination for Convenience is increased from thirty (30) days to sixty (60) days prior written notice.`,
      `2. Clause 3.1 is hereby amended: The total aggregate contract amount is increased from AED 250,000 to AED 350,000 to account for additional engineering deliverables.\n3. New Clause 8 (Data Protection): Provider shall adhere to standard data privacy standards and process Customer personal data strictly in compliance with applicable UAE data protection regulations.\n\nIn all other respects, the Agreement remains in full force and effect.`,
    ];
    const amendmentBuffer = createSyntheticPdf(amendmentPages);
    await createDocumentFromUpload("Amendment_No_1_Services_Agreement.pdf", amendmentBuffer);

    return NextResponse.json({ success: true, count: 3 }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
