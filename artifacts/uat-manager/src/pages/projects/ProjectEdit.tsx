import { useLocation, useParams } from "wouter";
import { useGetProject, useUpdateProject, getGetProjectQueryKey, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectEdit() {
  const { projectId } = useParams();
  const id = parseInt(projectId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });
  
  const updateProject = useUpdateProject();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6 max-w-3xl">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <Card><CardContent className="h-96 bg-muted/20"></CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12">Project not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/projects/${id}`)} className="-ml-3 text-muted-foreground">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Project
        </Button>
      </div>
      
      <PageHeader 
        title="Edit Project" 
        description={`Update details for ${project.projectCode}`}
      />

      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ProjectForm 
            initialData={project}
            isSubmitting={updateProject.isPending}
            onSubmit={(data) => {
              updateProject.mutate(
                { projectId: id, data },
                {
                  onSuccess: () => {
                    toast({ title: "Project updated successfully" });
                    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
                    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
                    setLocation(`/projects/${id}`);
                  },
                  onError: (error) => {
                    toast({ 
                      title: "Failed to update project", 
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