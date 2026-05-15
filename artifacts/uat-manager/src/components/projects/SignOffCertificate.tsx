import { format } from "date-fns";
import { CheckCircle2, AlertCircle } from "lucide-react";
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

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border shadow-sm print:shadow-none print:border-none print:p-0">
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
          <p className="text-sm text-slate-600">Signed by: <span className="font-semibold">{signOffData.signedBy}</span></p>
          <p className="text-sm text-slate-600">Date: {format(new Date(signOffData.signedAt), "d MMMM yyyy, HH:mm")}</p>
        </div>
      </div>

      <div className="mb-10 print:mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Compliance Confirmations</h3>
        <div className="space-y-3">
          {Object.entries({
            "All planned tests were executed.": signOffData.confirmations.allPlannedTestsExecuted,
            "All critical (P0/P1) defects are resolved.": signOffData.confirmations.criticalDefectsResolved,
            "Business stakeholders have verified the results.": signOffData.confirmations.stakeholdersVerified,
            "The system meets defined business requirements.": signOffData.confirmations.meetsRequirements,
            "The deployment team is aware of the approval.": signOffData.confirmations.deploymentAware,
          }).map(([text, confirmed]) => (
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
        <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Last Test Run Results ({lastRun.name})</h3>
        <div className="space-y-2">
          {lastRun.useCases.map((uc: any) => (
            <div key={uc.id} className="flex items-center justify-between p-2 border rounded bg-slate-50/50 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-slate-400">{uc.useCaseCode}</span>
                <span className="font-medium text-slate-700">{uc.useCaseName}</span>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                uc.status === 'passed' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
              }`}>
                {uc.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {signOffData.openIssues?.length > 0 && (
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
          <p className="text-[10px] font-bold text-slate-400 uppercase">Project Owner Signature</p>
          <p className="text-sm font-semibold text-slate-800">{signOffData.signedBy}</p>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Generated by</p>
           <p className="text-xs font-medium text-slate-700 italic">UAT Management System</p>
        </div>
      </div>
    </div>
  );
}
