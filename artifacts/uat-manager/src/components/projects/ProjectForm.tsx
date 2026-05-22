import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { TestProjectDetail } from "@workspace/api-client-react";
import { getAuthUser } from "@/lib/auth";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  designedBy: z.string().min(1, "Designer name is required"),
  moduleName: z.string().min(1, "Module name is required"),
  designDate: z.string().min(1, "Design date is required"),
  testLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  testLeadId: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export type ProjectFormSubmitData = Omit<ProjectFormValues, "testLeadId"> & {
  testLeadId?: number;
};

interface ProjectFormProps {
  initialData?: TestProjectDetail;
  onSubmit: (data: ProjectFormSubmitData) => void;
  isSubmitting?: boolean;
}

export function ProjectForm({ initialData, onSubmit, isSubmitting }: ProjectFormProps) {
  const currentUser = getAuthUser();
  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey(), enabled: currentUser?.role === "ADMIN" },
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || "",
      designedBy: initialData?.designedBy || "",
      moduleName: initialData?.moduleName || "",
      designDate: initialData?.designDate || new Date().toISOString().split('T')[0],
      testLink: initialData?.testLink || "",
      testLeadId: (initialData as any)?.testLeadId?.toString() || "",
    },
  });

  const handleSubmit = (values: ProjectFormValues) => {
    const { testLeadId: testLeadIdStr, ...rest } = values;
    onSubmit({
      ...rest,
      testLeadId: testLeadIdStr ? parseInt(testLeadIdStr, 10) : undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Authentication Flow Redesign" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="moduleName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Module</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Core System, Settings" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="designedBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Designed By (QA Lead)</FormLabel>
                <FormControl>
                  <Input placeholder="Name of QA lead" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="designDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Design Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="testLink"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Test Environment URL (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="https://staging.example.com" {...field} />
                </FormControl>
                <FormDescription>Link to the environment where this UAT will be performed</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {currentUser?.role === "ADMIN" && (
            <FormField
              control={form.control}
              name="testLeadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Lead</FormLabel>
                  <FormControl>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a Test Lead..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name} ({u.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>The Test Lead will manage this project's test runs</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
