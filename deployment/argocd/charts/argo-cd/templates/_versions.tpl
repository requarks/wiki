{{/* vim: set filetype=mustache: */}}
{{/*
Return the target Kubernetes version
*/}}
{{- define "argo-cd.kubeVersion" -}}
{{- default .Capabilities.KubeVersion.Version .Values.kubeVersionOverride }}
{{- end }}
