import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X, Paperclip, FileIcon } from "lucide-react";
import { resolveUploadUrl } from "@/lib/upload-url";

export function TestRunResultsView({ data }: { data: any }) {
  if (!data || !data.useCases) return null;

  return (
    <div className="space-y-4">
      <Accordion type="multiple" className="w-full space-y-2">
        {data.useCases.map((uc: any) => (
          <AccordionItem key={uc.id} value={`uc-${uc.id}`} className="border rounded-lg bg-card shadow-sm overflow-hidden border-border/50">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
              <div className="flex items-center justify-between w-full pr-4 text-left">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    uc.status === 'passed' ? "bg-green-500" : 
                    uc.status === 'failed' ? "bg-red-500" : 
                    uc.status === 'in_progress' ? "bg-blue-500" : "bg-slate-300"
                  )} />
                  <span className="font-mono text-xs text-muted-foreground">{uc.useCaseCode}</span>
                  <span className="font-semibold">{uc.useCaseName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Tester: {uc.assignedTesterName || "Unassigned"}</span>
                  <StatusBadge status={uc.status} />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 border-t bg-muted/5">
              <div className="space-y-4 mt-2">
                <Accordion type="multiple" className="w-full space-y-2">
                  {uc.testCases.map((tc: any) => (
                    <AccordionItem key={tc.id} value={`tc-${tc.id}`} className="border rounded-md bg-card shadow-sm overflow-hidden border-border/50">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50">
                        <div className="flex items-center justify-between w-full pr-4 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground uppercase">TC-{tc.caseNumber}</span>
                            <span className="text-sm font-medium">{tc.title}</span>
                          </div>
                          <StatusBadge status={tc.execution?.status === 'completed' ? 'passed' : tc.execution?.status === 'failed' ? 'failed' : 'pending'} />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-2 border-t">
                         <div className="space-y-3 mt-2">
                            {tc.steps.map((step: any) => (
                              <div key={step.id} className="border rounded p-3 space-y-3 bg-muted/5 border-border/40">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                      {step.stepNumber}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium leading-snug">{step.instruction}</p>
                                      <p className="text-xs text-muted-foreground italic">Expected: {step.expectedResult}</p>
                                    </div>
                                  </div>
                                  <div className="shrink-0">
                                    {step.result ? (
                                      <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                                        step.result.passed ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"
                                      )}>
                                        {step.result.passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                        {step.result.passed ? "Passed" : "Failed"}
                                      </div>
                                    ) : (
                                      <div className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-slate-100 text-slate-500 border-slate-200">
                                        Pending
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
{step.attachments?.length > 0 && (
                                 <div className="col-span-full pt-1 space-y-1">
                                   <span className="text-[10px] uppercase font-bold text-muted-foreground block">Reference Files</span>
                                   <div className="flex flex-wrap gap-2">
                                     {step.attachments.map((att: any) => (
                                       <a key={att.id} href={resolveUploadUrl(att.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 text-primary rounded border border-primary/10 text-[10px] font-medium hover:bg-primary/10 transition-colors">
                                         <FileIcon className="w-3 h-3" /> {att.fileName}
                                       </a>
                                     ))}
                                   </div>
                                 </div>
                               )}

                                {step.result && (
                                   <div className="ml-9 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-border/40">
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Actual Result</span>
                                      <p className="text-xs text-foreground/90 bg-muted/20 p-2 rounded border border-border/20">{step.result.actualResult || "No result recorded"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Comments</span>
                                      <p className="text-xs text-foreground/90 italic bg-muted/20 p-2 rounded border border-border/20">{step.result.comments || "No comments"}</p>
                                    </div>
                                    {step.result.attachments?.length > 0 && (
                                      <div className="col-span-full pt-1 space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Evidence</span>
                                        <div className="flex flex-wrap gap-2">
                                          {step.result.attachments.map((att: any) => (
                                            <a key={att.id} href={resolveUploadUrl(att.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 text-primary rounded border border-primary/10 text-[10px] font-medium hover:bg-primary/10 transition-colors">
                                              <Paperclip className="w-3 h-3" /> {att.fileName}
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                         </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'passed') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 uppercase text-[10px] font-bold">Passed</Badge>;
  if (s === 'failed') return <Badge variant="destructive" className="uppercase text-[10px] font-bold">Failed</Badge>;
  if (s === 'in_progress') return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 uppercase text-[10px] font-bold">In Progress</Badge>;
  return <Badge variant="outline" className="uppercase text-[10px] font-bold text-muted-foreground">Pending</Badge>;
}
