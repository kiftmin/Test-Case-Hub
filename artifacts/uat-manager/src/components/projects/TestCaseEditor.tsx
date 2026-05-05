import { useState } from "react";
import { 
  useListTestSteps, getListTestStepsQueryKey,
  useCreateTestStep, useUpdateTestStep, useDeleteTestStep, useBulkCreateTestSteps
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";

interface TestCaseEditorProps {
  testCaseId: number;
}

export function TestCaseEditor({ testCaseId }: TestCaseEditorProps) {
  const queryClient = useQueryClient();
  const { data: steps = [], isLoading } = useListTestSteps(testCaseId, {
    query: { enabled: !!testCaseId, queryKey: getListTestStepsQueryKey(testCaseId) }
  });

  const createStep = useCreateTestStep();
  const updateStep = useUpdateTestStep();
  const deleteStep = useDeleteTestStep();
  const bulkCreate = useBulkCreateTestSteps();

  const [newInstruction, setNewInstruction] = useState("");
  const [newTestData, setNewTestData] = useState("");
  const [newExpectedResult, setNewExpectedResult] = useState("");

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const handleAddStep = async () => {
    if (!newInstruction || !newExpectedResult) return;
    
    await createStep.mutateAsync({
      testCaseId,
      data: {
        instruction: newInstruction,
        testData: newTestData || null,
        expectedResult: newExpectedResult
      }
    });
    
    queryClient.invalidateQueries({ queryKey: getListTestStepsQueryKey(testCaseId) });
    setNewInstruction("");
    setNewTestData("");
    setNewExpectedResult("");
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    
    // Parse bulk text (simple format: Instruction | Test Data | Expected Result)
    const lines = bulkText.split('\n').filter(l => l.trim());
    const parsedSteps = lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      return {
        instruction: parts[0] || 'Missing instruction',
        testData: parts.length > 2 ? parts[1] : null,
        expectedResult: parts.length > 2 ? parts[2] : (parts[1] || 'Missing expected result'),
      };
    });

    await bulkCreate.mutateAsync({
      testCaseId,
      data: { steps: parsedSteps }
    });
    
    queryClient.invalidateQueries({ queryKey: getListTestStepsQueryKey(testCaseId) });
    setBulkMode(false);
    setBulkText("");
  };

  const handleDelete = async (stepId: number) => {
    await deleteStep.mutateAsync({ stepId });
    queryClient.invalidateQueries({ queryKey: getListTestStepsQueryKey(testCaseId) });
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading steps...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
        <h3 className="font-semibold text-lg">Test Steps</h3>
        <Button variant="outline" size="sm" onClick={() => setBulkMode(!bulkMode)}>
          {bulkMode ? "Single Entry" : "Bulk Add"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4 p-4 border rounded-lg bg-card shadow-sm group">
            <div className="flex flex-col items-center justify-between">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                {step.stepNumber}
              </div>
              <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab mt-auto" />
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Action</span>
                <p className="text-sm">{step.instruction}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Data</span>
                <p className="text-sm text-muted-foreground">{step.testData || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Expected</span>
                <p className="text-sm font-medium">{step.expectedResult}</p>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 text-destructive self-start"
              onClick={() => handleDelete(step.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {steps.length === 0 && !bulkMode && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No steps added yet. Start by adding one below.
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-muted/10">
        {bulkMode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste steps separated by pipes (|). Format: <br/>
              <code className="bg-muted px-1 rounded">Instruction | Test Data | Expected Result</code> or <br/>
              <code className="bg-muted px-1 rounded">Instruction | Expected Result</code>
            </p>
            <Textarea 
              placeholder="Click Login | user/pass | Navigates to dashboard&#10;Click Profile | | Shows profile modal"
              className="font-mono text-sm h-32"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
            <Button onClick={handleBulkAdd} className="w-full" disabled={!bulkText.trim() || bulkCreate.isPending}>
              {bulkCreate.isPending ? "Adding..." : "Import Steps"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Instruction</label>
              <Input 
                placeholder="What should the tester do?" 
                value={newInstruction}
                onChange={e => setNewInstruction(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Test Data (Optional)</label>
              <Input 
                placeholder="Inputs needed" 
                value={newTestData}
                onChange={e => setNewTestData(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Expected Result</label>
              <Input 
                placeholder="What should happen?" 
                value={newExpectedResult}
                onChange={e => setNewExpectedResult(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStep()}
              />
            </div>
            <Button onClick={handleAddStep} disabled={!newInstruction || !newExpectedResult || createStep.isPending}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}