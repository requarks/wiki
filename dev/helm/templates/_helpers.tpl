{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "wiki.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "wiki.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "wiki.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "wiki.labels" -}}
helm.sh/chart: {{ include "wiki.chart" . }}
{{ include "wiki.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "wiki.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wiki.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "wiki.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{ default (include "wiki.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
PostgreSQL fullname
*/}}
{{- define "wiki.postgresql.fullname" -}}
{{- printf "%s-%s" (include "wiki.fullname" .) "postgresql" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
PostgreSQL selector labels
*/}}
{{- define "wiki.postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wiki.name" . }}-postgresql
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Set postgres host
*/}}
{{- define "wiki.postgresql.host" -}}
{{- if .Values.postgresql.enabled -}}
{{- include "wiki.postgresql.fullname" . -}}
{{- else -}}
{{- .Values.postgresql.postgresqlHost | default "localhost" | quote -}}
{{- end -}}
{{- end -}}

{{/*
Set postgres secret
*/}}
{{- define "wiki.postgresql.secret" -}}
{{- if and .Values.postgresql.enabled .Values.postgresql.existingSecret -}}
    {{- .Values.postgresql.existingSecret -}}
{{- else if .Values.postgresql.enabled -}}
    {{- include "wiki.postgresql.fullname" . -}}
{{- else -}}
    {{- template "wiki.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
Set postgres secretUserKey
*/}}
{{- define "wiki.postgresql.secretUserKey" -}}
{{- if and .Values.postgresql.enabled .Values.postgresql.existingSecret -}}
    {{- default "postgresql-username" .Values.postgresql.existingSecretUserKey | quote -}}
{{- else if .Values.postgresql.enabled -}}
    "postgresql-username"
{{- else -}}
    {{- default "postgresql-username" .Values.postgresql.existingSecretUserKey | quote -}}
{{- end -}}
{{- end -}}

{{/*
Set postgres secretKey
*/}}
{{- define "wiki.postgresql.secretKey" -}}
{{- if and .Values.postgresql.enabled .Values.postgresql.existingSecret -}}
    {{- default "postgresql-password" .Values.postgresql.existingSecretKey | quote -}}
{{- else if .Values.postgresql.enabled -}}
    "postgresql-password"
{{- else -}}
    {{- default "postgresql-password" .Values.postgresql.existingSecretKey | quote -}}
{{- end -}}
{{- end -}}

{{/*
Set postgres secretDatabaseKey
*/}}
{{- define "wiki.postgresql.secretDatabaseKey" -}}
{{- if and .Values.postgresql.enabled .Values.postgresql.existingSecret -}}
    {{- default "postgresql-database" .Values.postgresql.existingSecretDatabaseKey | quote -}}
{{- else if .Values.postgresql.enabled -}}
    "postgresql-database"
{{- else -}}
    {{- default "postgresql-database" .Values.postgresql.existingSecretDatabaseKey | quote -}}
{{- end -}}
{{- end -}}
