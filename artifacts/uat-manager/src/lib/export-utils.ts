import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export function exportProjectToExcel(project: any) {
  const wb = XLSX.utils.book_new();
  
  // 1. Project Summary Sheet
  const summaryData = [
    ["Project Name", project.name],
    ["Project Code", project.projectCode],
    ["Designed By", project.designedBy],
    ["Module Name", project.moduleName],
    ["Version", project.version],
    ["Version Date", project.versionDate],
    ["Exported At", format(new Date(), "yyyy-MM-dd HH:mm")],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // 2. Test Cases Sheet
  const testCaseRows: any[] = [];
  testCaseRows.push(["UC Code", "Use Case", "TC #", "Test Case Title", "Step #", "Instruction", "Test Data", "Expected Result"]);

  project.useCases.forEach((uc: any) => {
    uc.testCases.forEach((tc: any) => {
      tc.steps.forEach((step: any) => {
        testCaseRows.push([
          uc.code,
          uc.name,
          tc.caseNumber,
          tc.title,
          step.stepNumber,
          step.instruction,
          step.testData || "",
          step.expectedResult
        ]);
      });
      if (tc.steps.length === 0) {
        testCaseRows.push([uc.code, uc.name, tc.caseNumber, tc.title, "", "No steps defined", "", ""]);
      }
    });
  });

  const tcWs = XLSX.utils.aoa_to_sheet(testCaseRows);
  XLSX.utils.book_append_sheet(wb, tcWs, "Test Plan");

  // Generate and download
  XLSX.writeFile(wb, `${project.projectCode}_TestPlan_${format(new Date(), "yyyyMMdd")}.xlsx`);
}

export function exportProjectToPDF(project: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.text("UAT Test Plan", 14, 22);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`${project.name} (${project.projectCode})`, 14, 30);
  doc.text(`Version: ${project.version}.0 | Date: ${project.versionDate}`, 14, 36);
  doc.line(14, 40, pageWidth - 14, 40);

  let currentY = 50;

  project.useCases.forEach((uc: any) => {
    // Use Case Header
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`${uc.code}: ${uc.name}`, 14, currentY);
    currentY += 10;

    uc.testCases.forEach((tc: any) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`TC-${tc.caseNumber}: ${tc.title}`, 20, currentY);
      currentY += 6;

      const tableData = tc.steps.map((s: any) => [
        s.stepNumber,
        s.instruction,
        s.testData || "-",
        s.expectedResult
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Instruction', 'Data', 'Expected Result']],
        body: tableData,
        margin: { left: 20 },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    currentY += 5;
  });

  doc.save(`${project.projectCode}_TestPlan_${format(new Date(), "yyyyMMdd")}.pdf`);
}

export function exportResultsToExcel(stats: any) {
  const wb = XLSX.utils.book_new();
  
  // Summary
  const summaryData = [
    ["Project", stats.projectName],
    ["Total Test Cases", stats.totalTestCases],
    ["Total Executions", stats.totalExecutions],
    ["Passed", stats.passed],
    ["Failed", stats.failed],
    ["Pending", stats.pending],
    ["Pass Rate", `${stats.passRate.toFixed(1)}%`],
    ["Report Date", format(new Date(), "yyyy-MM-dd HH:mm")],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Breakdown
  const breakdownData = [
    ["Use Case ID", "Use Case Name", "Passed", "Failed", "Pending"]
  ];
  stats.useCaseBreakdown.forEach((uc: any) => {
    breakdownData.push([
      uc.useCaseId,
      uc.useCaseName,
      uc.passed,
      uc.failed,
      uc.pending
    ]);
  });
  const breakdownWs = XLSX.utils.aoa_to_sheet(breakdownData);
  XLSX.utils.book_append_sheet(wb, breakdownWs, "Breakdown");

  XLSX.writeFile(wb, `${stats.projectName}_ExecutionReport_${format(new Date(), "yyyyMMdd")}.xlsx`);
}

export function exportTestRunToPDF(run: any, detailedData: any = null) {
  console.log("Starting PDF generation for Run ID:", run.id, "Detailed:", !!detailedData);
  if (detailedData) console.log("Detailed Data Structure:", detailedData);

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFontSize(20);
    doc.text("Test Run Execution Report", 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${run.name} (ID: ${run.id})`, 14, 30);
    doc.text(`Scheduled: ${format(new Date(run.scheduledAt), "yyyy-MM-dd HH:mm")}`, 14, 36);
    
    const statusText = (run.status || "unknown").toUpperCase();
    const passedText = run.passed === true ? "PASSED" : run.passed === false ? "FAILED" : "PENDING";
    doc.text(`Status: ${statusText} | Result: ${passedText}`, 14, 42);
    doc.line(14, 46, pageWidth - 14, 46);

    let currentY = 56;

    if (detailedData && detailedData.useCases) {
      // Detailed Section
      detailedData.useCases.forEach((uc: any) => {
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`Use Case: ${uc.useCaseCode || uc.useCaseId} - ${uc.useCaseName || "Unnamed"}`, 14, currentY);
        currentY += 6;
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Tester: ${uc.assignedTesterName || "Unassigned"} | Status: ${(uc.status || "pending").toUpperCase()}`, 14, currentY);
        currentY += 10;

        if (uc.testCases && Array.isArray(uc.testCases)) {
          uc.testCases.forEach((tc: any) => {
            if (currentY > pageHeight - 50) {
              doc.addPage();
              currentY = 20;
            }

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            const tcResult = tc.execution ? tc.execution.status.toUpperCase() : "PENDING";
            doc.text(`TC-${tc.caseNumber}: ${tc.title} [${tcResult}]`, 20, currentY);
            currentY += 6;

            const tableData = (tc.steps || []).map((s: any) => [
              s.stepNumber,
              s.instruction,
              s.result ? (s.result.passed ? "PASSED" : (s.result.passed === false ? "FAILED" : "IN PROGRESS")) : "-",
              s.result?.actualResult || "-",
              s.result?.comments || "-"
            ]);

            autoTable(doc, {
              startY: currentY,
              head: [['#', 'Instruction', 'Result', 'Actual Result', 'Comments']],
              body: tableData,
              margin: { left: 20 },
              styles: { fontSize: 8 },
              headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
              didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 2) {
                  if (data.cell.raw === 'PASSED') data.cell.styles.textColor = [0, 128, 0];
                  if (data.cell.raw === 'FAILED') data.cell.styles.textColor = [255, 0, 0];
                }
              }
            });

            currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : currentY + 10;
          });
        }

        currentY += 5;
      });
    } else {
      // Summary Table
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text("Use Case Executions Summary", 14, currentY);
      currentY += 6;

      const tableData = (run.useCases || []).map((uc: any) => [
        uc.useCaseCode || "-",
        uc.useCaseName || "-",
        uc.assignedTesterName || "Unassigned",
        uc.freePass ? "Yes" : "No",
        (uc.status || "pending").toUpperCase()
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Code', 'Use Case', 'Tester', 'Free Pass', 'Status']],
        body: tableData,
        margin: { left: 14 },
        styles: { fontSize: 10 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            if (data.cell.raw === 'PASSED') {
              data.cell.styles.textColor = [0, 128, 0];
            } else if (data.cell.raw === 'FAILED') {
              data.cell.styles.textColor = [255, 0, 0];
            }
          }
        }
      });
    }

    const dateStr = format(new Date(), "yyyyMMdd_HHmm");
    const fileName = `TestRun_${run.id}_${detailedData ? "Detailed" : "Summary"}_Report_${dateStr}.pdf`.replace(/[^a-z0-9.]/gi, '_');
    
    console.log("Final Filename:", fileName);
    console.log("Generating Blob...");
    
    const blob = doc.output('blob');
    console.log("Blob Size:", blob.size, "bytes");
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName); // Use setAttribute for better compatibility
    document.body.appendChild(link);
    
    console.log("Clicking link...");
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log("PDF download triggered.");

  } catch (err) {
    console.error("Critical error during PDF generation:", err);
    alert("Failed to generate PDF. Check console for details.");
  }
}
