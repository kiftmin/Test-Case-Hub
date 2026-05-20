import { useLocation } from "wouter";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="-ml-3 text-muted-foreground">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Projects
        </Button>
      </div>

      <PageHeader
        title="Create New Project"
        description="Set up a new User Acceptance Testing project to begin defining test cases."
      />

      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ProjectForm
            isSubmitting={createProject.isPending}
            onSubmit={(data) => {
              createProject.mutate(
                { data },
                {
                  onSuccess: (project) => {
                    toast({ title: "Project created successfully" });
                    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
                    setLocation(`/projects/${project.id}`);
                  },
                  onError: (error) => {
                    toast({
                      title: "Failed to create project",
                      description: error.message || "An error occurred",
                      variant: "destructive"
                    });
                  }
                }
              );
            }}
          />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
