const fs = require('fs');

let content = fs.readFileSync('src/app/admin/trials/AdminTrialsManager.tsx', 'utf8');

// 1. Add getLeadStageKey and update getLeadStepIndex and PIPELINE_STEPS
const oldPipelineStepsAndLeadStepIndex = `export const PIPELINE_STEPS = [
  { id: "NEW", label: "New", description: "Lead inquiry registered" },
  { id: "CONTACTED", label: "Contacted", description: "WhatsApp or phone outreach recorded" },
  { id: "CONFIRMED", label: "Confirmed", description: "Faculty allotted & trial schedule locked" },
  { id: "COMPLETED", label: "Completed", description: "Trial session attended with evaluation" },
  { id: "FOLLOW_UP", label: "Follow-up", description: "Post-trial package consultation" },
  { id: "CONVERTED", label: "Converted", description: "Student enrolled in full course" },
];`;

const newPipelineStepsAndLeadStepIndex = `export type TrialLeadStageKey =
  | "NEW"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "FOLLOW_UP"
  | "CONVERTED";

export function getLeadStageKey(lead: AdminTrialRequestItem): TrialLeadStageKey {
  if (lead.isConverted) return "CONVERTED";
  if (lead.followUpAt && lead.lessonStatus === "COMPLETED") return "FOLLOW_UP";
  if (lead.lessonStatus === "COMPLETED") return "COMPLETED";
  if (lead.status === TrialRequestStatus.ALLOTTED) return "CONFIRMED";
  if (lead.isContacted) return "CONTACTED";
  return "NEW";
}

export const PIPELINE_STEPS = [
  { id: "NEW", label: "New Inquiry", description: "Lead inquiry registered" },
  { id: "CONTACTED", label: "Contacted", description: "WhatsApp or phone outreach recorded" },
  { id: "CONFIRMED", label: "Trial Scheduled", description: "Faculty allotted & trial schedule locked" },
  { id: "COMPLETED", label: "Trial Completed", description: "Trial session attended with evaluation" },
  { id: "FOLLOW_UP", label: "Follow-up", description: "Post-trial package consultation" },
  { id: "CONVERTED", label: "Enrolled", description: "Student enrolled in full course" },
];`;

content = content.replace(oldPipelineStepsAndLeadStepIndex, newPipelineStepsAndLeadStepIndex);

// Update getLeadStepIndex
const oldGetLeadStepIndex = `function getLeadStepIndex(lead: AdminTrialRequestItem): number {
  if (lead.isConverted) return 5;
  if (lead.followUpAt && new Date(lead.followUpAt) <= new Date() && lead.lessonStatus === "COMPLETED") return 4;
  if (lead.lessonStatus === "COMPLETED") return 3;
  if (lead.status === TrialRequestStatus.ALLOTTED) return 2;
  if (lead.isContacted) return 1;
  return 0; // New
}`;

const newGetLeadStepIndex = `function getLeadStepIndex(lead: AdminTrialRequestItem): number {
  const stage = getLeadStageKey(lead);
  switch (stage) {
    case "CONVERTED":
      return 5;
    case "FOLLOW_UP":
      return 4;
    case "COMPLETED":
      return 3;
    case "CONFIRMED":
      return 2;
    case "CONTACTED":
      return 1;
    case "NEW":
    default:
      return 0;
  }
}`;

content = content.replace(oldGetLeadStepIndex, newGetLeadStepIndex);

// 2. Update kpis and add stageCounts
const oldKpiSection = `  // KPIs
  const kpis = useMemo(() => {
    const total = requests.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newLeads = requests.filter(
      (r) => r.status === TrialRequestStatus.PENDING && !r.isContacted
    );
    const newToday = requests.filter(
      (r) => new Date(r.createdAt) >= startOfToday
    ).length;

    const contacted = requests.filter((r) => r.isContacted);
    const trialBooked = requests.filter(
      (r) => r.status === TrialRequestStatus.ALLOTTED
    );
    const trialComplete = requests.filter(
      (r) => r.lessonStatus === "COMPLETED"
    );
    const converted = requests.filter((r) => r.isConverted);

    return {
      newLeadsCount: newLeads.length,
      newLeadsToday: newToday,
      contactedCount: contacted.length,
      contactedPercent: total > 0 ? Math.round((contacted.length / total) * 100) : 0,
      trialBookedCount: trialBooked.length,
      trialCompleteCount: trialComplete.length,
      convertedCount: converted.length,
      conversionPercent: total > 0 ? Math.round((converted.length / total) * 100) : 0,
    };
  }, [requests]);`;

const newKpiSection = `  // Mutually Exclusive Stage Counts
  const stageCounts = useMemo(() => {
    let newCount = 0;
    let contactedCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let followUpCount = 0;
    let convertedCount = 0;

    requests.forEach((r) => {
      const stage = getLeadStageKey(r);
      if (stage === "NEW") newCount++;
      else if (stage === "CONTACTED") contactedCount++;
      else if (stage === "CONFIRMED") confirmedCount++;
      else if (stage === "COMPLETED") completedCount++;
      else if (stage === "FOLLOW_UP") followUpCount++;
      else if (stage === "CONVERTED") convertedCount++;
    });

    return {
      newCount,
      contactedCount,
      confirmedCount,
      completedCount,
      followUpCount,
      convertedCount,
      activeCount: requests.length - convertedCount,
      total: requests.length,
    };
  }, [requests]);

  // KPIs (Excluding converted students from in-progress funnel stages)
  const kpis = useMemo(() => {
    const total = requests.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const newLeads = requests.filter(
      (r) => r.status === TrialRequestStatus.PENDING && !r.isContacted && !r.isConverted
    );
    const newToday = requests.filter(
      (r) => new Date(r.createdAt) >= startOfToday && !r.isConverted
    ).length;

    const contacted = requests.filter(
      (r) => r.isContacted && r.status === TrialRequestStatus.PENDING && !r.isConverted
    );
    const trialBooked = requests.filter(
      (r) => r.status === TrialRequestStatus.ALLOTTED && r.lessonStatus !== "COMPLETED" && !r.isConverted
    );
    const trialComplete = requests.filter(
      (r) => r.lessonStatus === "COMPLETED" && !r.isConverted
    );
    const converted = requests.filter((r) => r.isConverted);

    return {
      newLeadsCount: newLeads.length,
      newLeadsToday: newToday,
      contactedCount: contacted.length,
      contactedPercent: total > 0 ? Math.round((contacted.length / total) * 100) : 0,
      trialBookedCount: trialBooked.length,
      trialCompleteCount: trialComplete.length,
      convertedCount: converted.length,
      conversionPercent: total > 0 ? Math.round((converted.length / total) * 100) : 0,
    };
  }, [requests]);`;

content = content.replace(oldKpiSection, newKpiSection);

// 3. Update filteredRequests pipelineStageFilter logic
const oldFilterSection = `      if (pipelineStageFilter !== "ALL") {
        if (
          pipelineStageFilter === "NEW_LEADS" &&
          (r.status !== TrialRequestStatus.PENDING || r.isContacted)
        )
          return false;
        if (pipelineStageFilter === "CONTACTED" && !r.isContacted) return false;
        if (
          pipelineStageFilter === "TRIAL_BOOKED" &&
          r.status !== TrialRequestStatus.ALLOTTED
        )
          return false;
        if (
          pipelineStageFilter === "TRIAL_COMPLETE" &&
          r.lessonStatus !== "COMPLETED"
        )
          return false;
        if (pipelineStageFilter === "CONVERTED" && !r.isConverted) return false;
      }`;

const newFilterSection = `      if (pipelineStageFilter !== "ALL") {
        const stage = getLeadStageKey(r);
        if (pipelineStageFilter === "ALL_ACTIVE") {
          // All active in-progress stages (excluding converted students)
          if (r.isConverted || stage === "CONVERTED") return false;
        } else if (
          pipelineStageFilter === "NEW_LEADS" ||
          pipelineStageFilter === "NEW"
        ) {
          if (stage !== "NEW") return false;
        } else if (pipelineStageFilter === "CONTACTED") {
          if (stage !== "CONTACTED") return false;
        } else if (
          pipelineStageFilter === "TRIAL_BOOKED" ||
          pipelineStageFilter === "CONFIRMED"
        ) {
          if (stage !== "CONFIRMED") return false;
        } else if (
          pipelineStageFilter === "TRIAL_COMPLETE" ||
          pipelineStageFilter === "COMPLETED"
        ) {
          if (stage !== "COMPLETED") return false;
        } else if (pipelineStageFilter === "FOLLOW_UP") {
          if (stage !== "FOLLOW_UP") return false;
        } else if (pipelineStageFilter === "CONVERTED") {
          if (stage !== "CONVERTED") return false;
        }
      }`;

content = content.replace(oldFilterSection, newFilterSection);

// Also update upcomingConfirmedTrials to exclude converted students
content = content.replace(
  `    const confirmed = requests.filter(
      (r) =>
        r.status === TrialRequestStatus.ALLOTTED &&
        r.lessonStatus !== "COMPLETED"
    );`,
  `    const confirmed = requests.filter(
      (r) =>
        r.status === TrialRequestStatus.ALLOTTED &&
        r.lessonStatus !== "COMPLETED" &&
        !r.isConverted
    );`
);

// 4. Update Dropdown and Labels
const oldDropdown = `        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Pipeline stage
          </label>
          <select
            value={pipelineStageFilter}
            onChange={(e) => setPipelineStageFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="ALL">All active stages</option>
            <option value="NEW_LEADS">New leads</option>
            <option value="CONTACTED">Contacted</option>
            <option value="TRIAL_BOOKED">Confirmed / Booked</option>
            <option value="TRIAL_COMPLETE">Trial complete</option>
            <option value="CONVERTED">Converted</option>
          </select>
        </div>`;

const newDropdown = `        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-body/70 block">
            Trial Status
          </label>
          <select
            value={pipelineStageFilter}
            onChange={(e) => setPipelineStageFilter(e.target.value)}
            className="w-full rounded-xl bg-neutral-50/60 border border-neutral-200/80 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
          >
            <option value="ALL">All Students ({stageCounts.total})</option>
            <option value="ALL_ACTIVE">Active Trials Only ({stageCounts.activeCount})</option>
            <option value="NEW_LEADS">New Inquiries ({stageCounts.newCount})</option>
            <option value="CONTACTED">Contacted ({stageCounts.contactedCount})</option>
            <option value="TRIAL_BOOKED">Trial Scheduled ({stageCounts.confirmedCount})</option>
            <option value="TRIAL_COMPLETE">Trial Completed ({stageCounts.completedCount})</option>
            <option value="FOLLOW_UP">Needs Follow-up ({stageCounts.followUpCount})</option>
            <option value="CONVERTED">Enrolled / Converted ({stageCounts.convertedCount})</option>
          </select>
        </div>`;

content = content.replace(oldDropdown, newDropdown);

// 5. Update Table Column Header from "Pipeline stage" to "Trial Status"
content = content.replace(
  '<th className="py-3 px-4">Pipeline stage</th>',
  '<th className="py-3 px-4">Trial Status</th>'
);

// 6. Update Drawer and Stepper Titles
content = content.replace(
  'Workflow Pipeline Progress',
  'Student Trial Progress'
);
content = content.replace(
  'Workflow Pipeline',
  'Trial Journey'
);

// 7. Update renderStatusBadge to use getLeadStageKey
const oldBadgeFn = `  const renderStatusBadge = (lead: AdminTrialRequestItem) => {
    if (lead.isConverted) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
          Converted
        </span>
      );
    }
    if (lead.lessonStatus === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          Completed
        </span>
      );
    }
    if (lead.status === TrialRequestStatus.ALLOTTED) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          Confirmed
        </span>
      );
    }
    if (lead.isContacted) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          Contacted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        New Lead
      </span>
    );
  };`;

const newBadgeFn = `  const renderStatusBadge = (lead: AdminTrialRequestItem) => {
    const stage = getLeadStageKey(lead);
    if (stage === "CONVERTED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
          Enrolled
        </span>
      );
    }
    if (stage === "FOLLOW_UP") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          Follow-up
        </span>
      );
    }
    if (stage === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          Trial Done
        </span>
      );
    }
    if (stage === "CONFIRMED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          Scheduled
        </span>
      );
    }
    if (stage === "CONTACTED") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          Contacted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        New Inquiry
      </span>
    );
  };`;

content = content.replace(oldBadgeFn, newBadgeFn);

fs.writeFileSync('src/app/admin/trials/AdminTrialsManager.tsx', content, 'utf8');
console.log('Successfully updated AdminTrialsManager.tsx');

