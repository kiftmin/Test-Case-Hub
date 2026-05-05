import { useState } from "react";
import { useCreateUseCase, useCreateTestCase, useUpdateUseCase, useDeleteUseCase, useUpdateTestCase, useDeleteTestCase, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FileText, ChevronRight, ChevronDown, Plus, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

  const [expandedUseCases, setExpandedUseCases] = useState<Record<number, boolean>>({});
  const [newUseCaseName, setNewUseCaseName] = useState("");
  const [isAddingUseCase, setIsAddingUseCase] = useState(false);
  const [addingTestCaseTo, setAddingTestCaseTo] = useState<number | null>(null);
  const [newTestCaseTitle, setNewTestCaseTitle] = useState("");

  const toggleExpand = (id: number) => {
    setExpandedUseCases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddUseCase = async (e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newUseCaseName.trim()) {
      setIsAddingUseCase(false);
      return;
    }

    try {
      await createUseCase.mutateAsync({
        projectId: project.id,
        data: { name: newUseCaseName }
      });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
      setNewUseCaseName("");
      setIsAddingUseCase(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTestCase = async (useCaseId: number, e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newTestCaseTitle.trim()) {
      setAddingTestCaseTo(null);
      return;
    }

    try {
      await createTestCase.mutateAsync({
        useCaseId,
        data: { title: newTestCaseTitle }
      });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
      setNewTestCaseTitle("");
      setAddingTestCaseTo(null);
      setExpandedUseCases(prev => ({ ...prev, [useCaseId]: true }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-1">
      {project.useCases.map(useCase => (
        <div key={useCase.id} className="space-y-1">
          <div className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {expandedUseCases[useCase.id] && (
            <div className="pl-6 space-y-1">
              {useCase.testCases.map(testCase => (
                <div 
                  key={testCase.id}
                  onClick={() => onSelectTestCase(testCase.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                    selectedTestCaseId === testCase.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">TC-{testCase.caseNumber}: {testCase.title}</span>
                </div>
              ))}
              
              {addingTestCaseTo === useCase.id && (
                <div className="pl-2 pr-2 py-1">
                  <Input
                    autoFocus
                    size={1}
                    className="h-7 text-sm"
                    placeholder="New test case title..."
                    value={newTestCaseTitle}
                    onChange={e => setNewTestCaseTitle(e.target.value)}
                    onKeyDown={e => handleAddTestCase(useCase.id, e)}
                    onBlur={e => handleAddTestCase(useCase.id, e)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {isAddingUseCase ? (
        <div className="px-2 py-1">
          <Input
            autoFocus
            className="h-8 text-sm"
            placeholder="New Use Case Name..."
            value={newUseCaseName}
            onChange={e => setNewUseCaseName(e.target.value)}
            onKeyDown={handleAddUseCase}
            onBlur={handleAddUseCase}
          />
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