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
