{{/* Chart name, truncated to fit a DNS label. */}}
{{- define "wiki.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name. Truncated to 49 rather than 63 so that the longest suffix added to it
(`-postgresql-hl`) still fits in a DNS label.
*/}}
{{- define "wiki.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 49 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 49 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 49 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "wiki.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "wiki.commonLabels" -}}
helm.sh/chart: {{ include "wiki.chart" . }}
app.kubernetes.io/name: {{ include "wiki.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: wiki
{{- end }}

{{/*
The component is part of both selectors on purpose: without it, the wiki's Service and Deployment
would select the PostgreSQL pod too, which carries the same name and instance labels.
*/}}
{{- define "wiki.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wiki.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: wiki
{{- end }}

{{- define "wiki.labels" -}}
{{ include "wiki.commonLabels" . }}
app.kubernetes.io/component: wiki
{{- end }}

{{- define "wiki.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "wiki.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* `repository:tag`, or `repository@digest` when a digest is given. Takes the image dict and a default tag. */}}
{{- define "wiki.imageRef" -}}
{{- $img := index . 0 }}
{{- if $img.digest }}
{{- printf "%s@%s" $img.repository $img.digest }}
{{- else }}
{{- printf "%s:%s" $img.repository (toString (index . 1)) }}
{{- end }}
{{- end }}

{{- define "wiki.image" -}}
{{- include "wiki.imageRef" (list .Values.image (.Values.image.tag | default .Chart.AppVersion)) }}
{{- end }}

{{/* ---------------------------------------------------------------------------------------------- */}}
{{/* PostgreSQL                                                                                      */}}
{{/* ---------------------------------------------------------------------------------------------- */}}

{{- define "wiki.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "wiki.fullname" .) }}
{{- end }}

{{- define "wiki.postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wiki.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: postgresql
{{- end }}

{{- define "wiki.postgresql.labels" -}}
helm.sh/chart: {{ include "wiki.chart" . }}
app.kubernetes.io/name: {{ include "wiki.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.postgresql.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: wiki
app.kubernetes.io/component: postgresql
{{- end }}

{{- define "wiki.postgresql.image" -}}
{{- include "wiki.imageRef" (list .Values.postgresql.image .Values.postgresql.image.tag) }}
{{- end }}

{{- define "wiki.postgresql.secretName" -}}
{{- .Values.postgresql.auth.existingSecret | default (include "wiki.postgresql.fullname" .) }}
{{- end }}

{{/* ---------------------------------------------------------------------------------------------- */}}
{{/* The database the wiki connects to, bundled or external                                          */}}
{{/* ---------------------------------------------------------------------------------------------- */}}

{{- define "wiki.db.host" -}}
{{- if .Values.postgresql.enabled }}
{{- include "wiki.postgresql.fullname" . }}
{{- else }}
{{- .Values.externalDatabase.parameters.host }}
{{- end }}
{{- end }}

{{- define "wiki.db.port" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.service.port }}
{{- else }}
{{- .Values.externalDatabase.parameters.port }}
{{- end }}
{{- end }}

{{- define "wiki.db.name" -}}
{{- ternary .Values.postgresql.auth.database .Values.externalDatabase.parameters.database .Values.postgresql.enabled }}
{{- end }}

{{- define "wiki.db.user" -}}
{{- ternary .Values.postgresql.auth.username .Values.externalDatabase.parameters.user .Values.postgresql.enabled }}
{{- end }}

{{- define "wiki.db.schema" -}}
{{- ternary .Values.postgresql.schema .Values.externalDatabase.schema .Values.postgresql.enabled }}
{{- end }}

{{/* The Secret and key the wiki reads its database password from. */}}
{{- define "wiki.db.secretName" -}}
{{- if .Values.postgresql.enabled }}
{{- include "wiki.postgresql.secretName" . }}
{{- else if .Values.externalDatabase.parameters.existingSecret }}
{{- .Values.externalDatabase.parameters.existingSecret }}
{{- else }}
{{- printf "%s-db" (include "wiki.fullname" .) }}
{{- end }}
{{- end }}

{{- define "wiki.db.secretKey" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.secretKeys.userPasswordKey }}
{{- else if .Values.externalDatabase.parameters.existingSecret }}
{{- .Values.externalDatabase.parameters.existingSecretPasswordKey }}
{{- else -}}
password
{{- end }}
{{- end }}

{{/*
Whether the wiki is handed a connection string (DATABASE_URL) rather than individual parameters.
Truthy or empty, for `if`.
*/}}
{{- define "wiki.db.useUrl" -}}
{{- $url := .Values.externalDatabase.connectionString }}
{{- if and (not .Values.postgresql.enabled) (or $url.value $url.existingSecret) }}true{{ end }}
{{- end }}

{{/* The Secret and key the connection string is read from. */}}
{{- define "wiki.db.urlSecretName" -}}
{{- .Values.externalDatabase.connectionString.existingSecret | default (printf "%s-db" (include "wiki.fullname" .)) }}
{{- end }}

{{- define "wiki.db.urlSecretKey" -}}
{{- if .Values.externalDatabase.connectionString.existingSecret }}
{{- .Values.externalDatabase.connectionString.existingSecretKey }}
{{- else -}}
url
{{- end }}
{{- end }}

{{- define "wiki.db.tlsEnabled" -}}
{{- if and (not .Values.postgresql.enabled) .Values.externalDatabase.ssl.enabled }}true{{ end }}
{{- end }}

{{/* ---------------------------------------------------------------------------------------------- */}}
{{/* Generated secrets                                                                               */}}
{{/* ---------------------------------------------------------------------------------------------- */}}

{{/*
A password: the value given, else the one already stored in the Secret, else a new random one. The
lookup is what keeps a generated password across `helm upgrade`; it returns nothing to a render that
has no cluster access (`helm template`, Argo CD), which is why those should be given passwords.
Takes (list $ secretName key value).
*/}}
{{- define "wiki.secretValue" -}}
{{- $ctx := index . 0 }}
{{- $name := index . 1 }}
{{- $key := index . 2 }}
{{- $given := index . 3 }}
{{- if $given }}
{{- $given | b64enc }}
{{- else }}
{{- $existing := lookup "v1" "Secret" $ctx.Release.Namespace $name }}
{{- if and $existing (hasKey (default dict $existing.data) $key) }}
{{- index $existing.data $key }}
{{- else }}
{{- randAlphaNum 32 | b64enc }}
{{- end }}
{{- end }}
{{- end }}

{{/* ---------------------------------------------------------------------------------------------- */}}
{{/* Validation                                                                                      */}}
{{/* ---------------------------------------------------------------------------------------------- */}}

{{- define "wiki.validate" -}}
{{- if hasKey .Values.config "db" }}
{{- fail "config.db is set by the chart: configure the database under postgresql or externalDatabase instead" }}
{{- end }}
{{- range $key := list "port" "bindIP" "dataPath" }}
{{- if hasKey $.Values.config $key }}
{{- fail (printf "config.%s is set by the chart and cannot be overridden" $key) }}
{{- end }}
{{- end }}
{{- if and .Values.postgresql.enabled (eq .Values.postgresql.auth.username "postgres") }}
{{- fail "postgresql.auth.username must not be \"postgres\": the wiki connects as its own role, not as the superuser" }}
{{- end }}
{{- if not .Values.postgresql.enabled }}
{{- $url := .Values.externalDatabase.connectionString }}
{{- $params := .Values.externalDatabase.parameters }}
{{- if and $url.value $url.existingSecret }}
{{- fail "externalDatabase.connectionString: set value or existingSecret, not both" }}
{{- end }}
{{- $hasUrl := or $url.value $url.existingSecret }}
{{- $hasParams := or $params.host $params.password $params.existingSecret }}
{{- if and $hasUrl $hasParams }}
{{- fail "externalDatabase: use connectionString or parameters, not both — empty the one you are not using" }}
{{- end }}
{{- if not (or $hasUrl $hasParams) }}
{{- fail "externalDatabase: set either connectionString or parameters when postgresql.enabled is false" }}
{{- end }}
{{- if $hasParams }}
{{- if not $params.host }}
{{- fail "externalDatabase.parameters.host is required" }}
{{- end }}
{{- if not (or $params.password $params.existingSecret) }}
{{- fail "externalDatabase.parameters: password or existingSecret is required" }}
{{- end }}
{{- end }}
{{- end }}
{{- if and .Values.externalDatabase.ssl.existingSecret (ne (empty .Values.externalDatabase.ssl.certKey) (empty .Values.externalDatabase.ssl.keyKey)) }}
{{- fail "externalDatabase.ssl.certKey and externalDatabase.ssl.keyKey go together: set both for a client certificate, or neither" }}
{{- end }}
{{- end }}
