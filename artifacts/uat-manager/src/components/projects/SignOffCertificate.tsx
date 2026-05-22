import { format } from "date-fns";
import { CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignOffCertificateProps {
  project: any;
  signOffData: any;
  lastRun: any;
}

export function SignOffCertificate({ project, signOffData, lastRun }: SignOffCertificateProps) {
  const handlePrint = () => {
    window.print();
  };

  const testLead = signOffData?.testLead;
  const businessOwner = signOffData?.businessOwner;

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0 print-only">
      <div className="flex justify-between items-start mb-8 print:mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1 uppercase tracking-tight">Project Sign-off Certificate</h1>
          <p className="text-slate-500 font-medium">Project Code: {project.projectCode}</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="print:hidden">Print Certificate</Button>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10 pb-8 border-b print:mb-6 print:pb-6 print:gap-4">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Details</h3>
          <p className="text-lg font-semibold text-slate-800">{project.name}</p>
          <p className="text-sm text-slate-600">{project.moduleName}</p>
          <p className="text-sm text-slate-600 mt-1">Version: {project.version}.0</p>
        </div>
        <div className="text-right">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sign-off Status</h3>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm font-bold uppercase mb-2">
            <CheckCircle2 className="w-4 h-4" /> Signed Off
          </div>
        </div>
      </div>

      <div className="mb-10 print:mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Signatures</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-4 border rounded-lg bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Test Lead</h4>
            {testLead ? (
              <>
                <p className="text-sm font-semibold text-slate-800">{testLead.signedBy}</p>
                <p className="text-xs text-slate-500">{testLead.signedAt ? format(new Date(testLead.signedAt), "d MMMM yyyy, HH:mm") : ""}</p>
                {testLead.note && <p className="text-xs text-slate-600 mt-1 italic">"{testLead.note}"</p>}
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Not yet signed</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Business Owner</h4>
            {businessOwner ? (
              <>
                <p className="text-sm font-semibold text-slate-800">{businessOwner.signedBy}</p>
                <p className="text-xs text-slate-500">{businessOwner.signedAt ? format(new Date(businessOwner.signedAt), "d MMMM yyyy, HH:mm") : ""}</p>
                {businessOwner.note && <p className="text-xs text-slate-600 mt-1 italic">"{businessOwner.note}"</p>}
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Not yet signed</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10 print:mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Compliance Confirmations</h3>
        <div className="space-y-3">
          {Object.entries({
            "All planned tests were executed.": true,
            "All critical (P0/P1) defects are resolved.": true,
            "Business stakeholders have verified the results.": true,
            "The system meets defined business requirements.": true,
            "The deployment team is aware of the approval.": true,
          }).map(([text]) => (
            <div key={text} className="flex items-center gap-3 text-sm">
              <div className="w-5 h-5 rounded border border-green-300 bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-slate-700 font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10 print:mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">
          Last Test Run Results ({lastRun.name})
        </h3>
        <div className="space-y-2">
          {lastRun.useCases.map((uc: any) => {
            const status = uc.status || "passed";
            const isPassedByAgreement = status === "passed_by_agreement";
            const isFailed = status === "failed";

            return (
              <div key={uc.id}>
                <div className={`flex items-center justify-between p-2 border rounded text-sm ${
                  isPassedByAgreement ? 'bg-amber-50/50 border-amber-200' :
                  isFailed ? 'bg-red-50/50 border-red-200' :
                  'bg-slate-50/50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-slate-400">{uc.useCaseCode}</span>
                    <span className="font-medium text-slate-700">{uc.useCaseName}</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${
                    isPassedByAgreement ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    isFailed ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-green-100 text-green-800 border-green-200'
                  }`}>
                    {isPassedByAgreement ? <MinusCircle className="w-3 h-3" /> :
                     isFailed ? <AlertCircle className="w-3 h-3" /> :
                     <CheckCircle2 className="w-3 h-3" />}
                    {isPassedByAgreement ? "Passed by Agreement" :
                     isFailed ? "Failed" :
                     "Passed"}
                  </div>
                </div>
                {isPassedByAgreement && uc.testCases?.filter((tc: any) => tc.overallResult === "passed_by_agreement").map((tc: any) => (
                  <div key={tc.id} className="ml-8 mt-1 p-2 border border-amber-100 rounded bg-amber-50/30 text-xs text-slate-600">
                    <span className="font-medium">{tc.testCaseName || tc.name}</span>
                    {tc.businessOwnerNote && (
                      <p className="mt-0.5 text-amber-700 italic">Business Owner: "{tc.businessOwnerNote}"</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {signOffData?.openIssues?.length > 0 && (
        <div className="mb-10 print:mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
             Open Issues & Accepted Workarounds
          </h3>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md">
            <p className="text-xs text-amber-800 mb-3 font-medium">The following use cases failed in the final test run but are accepted to be fixed after release:</p>
            <div className="space-y-1.5">
              {signOffData.openIssues.map((issue: any) => {
                const uc = lastRun.useCases.find((u: any) => u.useCaseId === issue.useCaseId);
                return (
                  <div key={issue.useCaseId} className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-mono text-[10px]">{uc?.useCaseCode}</span>
                    <span className="text-slate-700 font-medium">{uc?.useCaseName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-dashed flex justify-between items-end print:mt-12">
        <div className="text-center">
          <div className="w-48 border-b border-slate-900 mb-2"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Test Lead Signature</p>
          {testLead && <p className="text-sm font-semibold text-slate-800">{testLead.signedBy}</p>}
        </div>
        <div className="text-center">
          <div className="w-48 border-b border-slate-900 mb-2"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Business Owner Signature</p>
          {businessOwner && <p className="text-sm font-semibold text-slate-800">{businessOwner.signedBy}</p>}
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Generated by</p>
           <p className="text-xs font-medium text-slate-700 italic">UAT Management System</p>
        </div>
      </div>
    </div>
  );
}