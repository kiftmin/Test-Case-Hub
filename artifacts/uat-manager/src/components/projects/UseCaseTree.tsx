import { useState } from "react";
import { useCreateUseCase, useCreateTestCase, useUpdateUseCase, useDeleteUseCase, useUpdateTestCase, useDeleteTestCase, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FileText, ChevronRight, ChevronDown, Plus, MoreHorizontal, Edit2, Trash2, Loader2, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TestProjectDetail } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface UseCaseTreeProps {
  project: TestProjectDetail;
  selectedTestCaseId: number | null;
  onSelectTestCase: (id: number) => void;
}

export function UseCaseTree({ project, selectedTestCaseId, onSelectTestCase }: UseCaseTreeProps) {
  const queryClient = useQueryClient();
  const createUseCase = useCreateUseCase();
  const createTestCase = useCreateTestCase();
  const updateUseCase = useUpdateUseCase();
  const deleteUseCase = useDeleteUseCase();
  const updateTestCase = useUpdateTestCase();
  const deleteTestCase = useDeleteTestCase();

  const [expandedUseCases, setExpandedUseCases] = useState<Record<number, boolean>>({});
  const [newUseCaseName, setNewUseCaseName] = useState("");
  const [isAddingUseCase, setIsAddingUseCase] = useState(false);
  const [addingTestCaseTo, setAddingTestCaseTo] = useState<number | null>(null);
  const [newTestCaseTitle, setNewTestCaseTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit state for use cases
  const [editingUseCaseId, setEditingUseCaseId] = useState<number | null>(null);
  const [editUseCaseName, setEditUseCaseName] = useState("");

  // Edit state for test cases
  const [editingTestCaseId, setEditingTestCaseId] = useState<number | null>(null);
  const [editTestCaseTitle, setEditTestCaseTitle] = useState("");

  const toggleExpand = (id: number) => {
    setExpandedUseCases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });

  const handleAddUseCase = async (e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newUseCaseName.trim()) {
      setIsAddingUseCase(false);
      return;
    }

    try {
      setIsSaving(true);
      await createUseCase.mutateAsync({
        projectId: project.id,
        data: { name: newUseCaseName }
      });
      await invalidate();
      setNewUseCaseName("");
      setIsAddingUseCase(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTestCase = async (useCaseId: number, e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newTestCaseTitle.trim()) {
      setAddingTestCaseTo(null);
      return;
    }

    try {
      setIsSaving(true);
      await createTestCase.mutateAsync({
        useCaseId,
        data: { title: newTestCaseTitle }
      });
      await invalidate();
      setNewTestCaseTitle("");
      setAddingTestCaseTo(null);
      setExpandedUseCases(prev => ({ ...prev, [useCaseId]: true }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Use Case edit/delete
  const startEditUseCase = (uc: { id: number; name: string }) => {
    setEditingUseCaseId(uc.id);
    setEditUseCaseName(uc.name);
  };

  const handleSaveUseCase = async (useCaseId: number) => {
    if (!editUseCaseName.trim()) return;
    try {
      setIsSaving(true);
      await updateUseCase.mutateAsync({ useCaseId, data: { name: editUseCaseName } });
      await invalidate();
      setEditingUseCaseId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUseCase = async (useCaseId: number) => {
    if (!confirm("Delete this use case and all its test cases? This cannot be undone.")) return;
    try {
      setIsSaving(true);
      await deleteUseCase.mutateAsync({ useCaseId });
      await invalidate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Test Case edit/delete
  const startEditTestCase = (tc: { id: number; title: string }) => {
    setEditingTestCaseId(tc.id);
    setEditTestCaseTitle(tc.title);
  };

  const handleSaveTestCase = async (testCaseId: number) => {
    if (!editTestCaseTitle.trim()) return;
    try {
      setIsSaving(true);
      await updateTestCase.mutateAsync({ testCaseId, data: { title: editTestCaseTitle } });
      await invalidate();
      setEditingTestCaseId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTestCase = async (testCaseId: number) => {
    if (!confirm("Delete this test case and all its steps? This cannot be undone.")) return;
    try {
      setIsSaving(true);
      await deleteTestCase.mutateAsync({ testCaseId });
      await invalidate();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      {project.useCases.map(useCase => (
        <div key={useCase.id} className="space-y-1">
          <div className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
            {editingUseCaseId === useCase.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  autoFocus
                  className="h-7 text-sm flex-1"
                  value={editUseCaseName}
                  onChange={e => setEditUseCaseName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveUseCase(useCase.id);
                    if (e.key === 'Escape') setEditingUseCaseId(null);
                  }}
                  disabled={isSaving}
                />
                <Button variant="ghost" size="icon" className="w-6 h-6 text-green-600" onClick={() => handleSaveUseCase(useCase.id)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setEditingUseCaseId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div 
                  className="flex items-center gap-2 flex-1 overflow-hidden"
                  onClick={() => toggleExpand(useCase.id)}
                >
                  {expandedUseCases[useCase.id] ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <Folder className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{useCase.code} - {useCase.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setAddingTestCaseTo(useCase.id);
                      setExpandedUseCases(prev => ({ ...prev, [useCase.id]: true }));
                    }}>
                      <Plus className="w-4 h-4 mr-2" /> Add Test Case
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => startEditUseCase(useCase)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteUseCase(useCase.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {expandedUseCases[useCase.id] && (
            <div className="pl-6 space-y-1">
              {useCase.testCases.map(testCase => (
                <div key={testCase.id} className="group/tc">
                  {editingTestCaseId === testCase.id ? (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <Input
                        autoFocus
                        className="h-7 text-sm flex-1"
                        value={editTestCaseTitle}
                        onChange={e => setEditTestCaseTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveTestCase(testCase.id);
                          if (e.key === 'Escape') setEditingTestCaseId(null);
                        }}
                        disabled={isSaving}
                      />
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-green-600" onClick={() => handleSaveTestCase(testCase.id)}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setEditingTestCaseId(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                        selectedTestCaseId === testCase.id 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 overflow-hidden" onClick={() => onSelectTestCase(testCase.id)}>
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate flex-1">TC-{testCase.caseNumber}: {testCase.title}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-5 h-5 opacity-0 group-hover/tc:opacity-100 shrink-0">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditTestCase(testCase)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteTestCase(testCase.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
              
              {addingTestCaseTo === useCase.id && (
                <div className="pl-2 pr-2 py-1 relative">
                  <Input
                    autoFocus
                    size={1}
                    className="h-7 text-sm"
                    placeholder="New test case title..."
                    value={newTestCaseTitle}
                    disabled={isSaving}
                    onChange={e => setNewTestCaseTitle(e.target.value)}
                    onKeyDown={e => handleAddTestCase(useCase.id, e)}
                    onBlur={e => handleAddTestCase(useCase.id, e)}
                  />
                  {isSaving && <Loader2 className="absolute right-4 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {isAddingUseCase ? (
        <div className="px-2 py-1 relative">
          <Input
            autoFocus
            className="h-8 text-sm"
            placeholder="New Use Case Name..."
            value={newUseCaseName}
            disabled={isSaving}
            onChange={e => setNewUseCaseName(e.target.value)}
            onKeyDown={handleAddUseCase}
            onBlur={handleAddUseCase}
          />
          {isSaving && <Loader2 className="absolute right-4 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground mt-2"
          onClick={() => setIsAddingUseCase(true)}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Use Case
        </Button>
      )}
    </div>
  );
}