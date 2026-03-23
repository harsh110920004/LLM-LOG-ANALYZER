"use client";

import { AiSessionModal } from "@/components/dashboard/AiSessionModal";
import { AlertsView } from "@/components/dashboard/AlertsView";
import { IngestView } from "@/components/dashboard/IngestView";
import { IntegrationModal } from "@/components/dashboard/IntegrationModal";
import { IntegrationsView } from "@/components/dashboard/IntegrationsView";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { UploadView } from "@/components/dashboard/UploadView";
import { Spinner } from "@/components/dashboard/ui";
import { useDashboardState } from "@/hooks/useDashboardState";

export default function Home() {
  const dashboard = useDashboardState();

  return (
    <div className="flex h-screen overflow-hidden bg-[#07080f] text-[#e8eeff] antialiased">
      {dashboard.loadingLabel && <Spinner label={dashboard.loadingLabel} />}

      <Sidebar
        tab={dashboard.tab}
        setTab={dashboard.setTab}
        aiModel={dashboard.aiModel}
        openAiModal={() => dashboard.setIsAiModalOpen(true)}
        openIntegrationModal={() => dashboard.setIsIntegrationModalOpen(true)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          tab={dashboard.tab}
          filteredAlertCount={dashboard.filteredAlerts.length}
          msg={dashboard.msg}
          seedDemo={dashboard.seedDemo}
          resetAll={dashboard.resetAll}
        />

        <main className="flex-1 overflow-y-auto">
          {dashboard.tab === "alerts" && (
            <AlertsView
              stats={dashboard.stats}
              openRate={dashboard.openRate}
              query={dashboard.query}
              setQuery={dashboard.setQuery}
              statusFilter={dashboard.statusFilter}
              setStatusFilter={dashboard.setStatusFilter}
              severityFilter={dashboard.severityFilter}
              setSeverityFilter={dashboard.setSeverityFilter}
              filteredAlerts={dashboard.filteredAlerts}
              selectedAlertId={dashboard.selectedAlertId}
              setSelectedAlertId={dashboard.setSelectedAlertId}
              selectedAlert={dashboard.selectedAlert}
              status={dashboard.status}
              setStatus={dashboard.setStatus}
              noteInput={dashboard.noteInput}
              setNoteInput={dashboard.setNoteInput}
              updateSelectedAlert={dashboard.updateSelectedAlert}
              aiModel={dashboard.aiModel}
              openAiModal={() => dashboard.setIsAiModalOpen(true)}
              explainSelectedAlert={dashboard.explainSelectedAlert}
              explanation={dashboard.explanation}
            />
          )}

          {dashboard.tab === "upload" && (
            <UploadView
              uploadFile={dashboard.uploadFile}
              setUploadFile={dashboard.setUploadFile}
              uploadReport={dashboard.uploadReport}
              aiModel={dashboard.aiModel}
              saveModel={dashboard.saveModel}
              uploadLogFile={dashboard.uploadLogFile}
              clearUploadSelection={dashboard.clearUploadSelection}
              msg={dashboard.msg}
            />
          )}

          {dashboard.tab === "ingest" && (
            <IngestView
              jsonInput={dashboard.jsonInput}
              setJsonInput={dashboard.setJsonInput}
              ingestCustom={dashboard.ingestCustom}
              msg={dashboard.msg}
            />
          )}

          {dashboard.tab === "integrations" && (
            <IntegrationsView
              integrations={dashboard.integrations}
              openIntegrationModal={() => dashboard.setIsIntegrationModalOpen(true)}
              setIntegrationForm={dashboard.setIntegrationForm}
              disconnectIntegration={dashboard.disconnectIntegration}
              msg={dashboard.msg}
            />
          )}
        </main>
      </div>

      <AiSessionModal
        isOpen={dashboard.isAiModalOpen}
        onClose={() => dashboard.setIsAiModalOpen(false)}
        aiModel={dashboard.aiModel}
        saveModel={dashboard.saveModel}
        customModel={dashboard.customModel}
        setCustomModel={dashboard.setCustomModel}
      />

      <IntegrationModal
        isOpen={dashboard.isIntegrationModalOpen}
        onClose={() => dashboard.setIsIntegrationModalOpen(false)}
        integrationForm={dashboard.integrationForm}
        setIntegrationForm={dashboard.setIntegrationForm}
        connectIntegration={dashboard.connectIntegration}
      />
    </div>
  );
}
