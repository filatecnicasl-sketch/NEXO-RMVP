import React from "react";
import { useParams } from "react-router-dom";
import ApplicationWizard from "@/pages/ApplicationWizard";

export default function AdminApplicationEdit() {
  const { id } = useParams();
  return <ApplicationWizard mode="admin-edit" applicationId={id} />;
}
