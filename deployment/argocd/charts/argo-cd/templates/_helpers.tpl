{{/* vim: set filetype=mustache: */}}
{{/*
Create controller name and version as used by the chart label.
Truncated at 52 chars because StatefulSet label 'controller-revision-hash' is limited
to 63 chars and it includes 10 chars of hash and a separating '-'.
*/}}
{{- define "argo-cd.controller.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.controller.name | trunc 52 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the controller service account to use
*/}}
{{- define "argo-cd.controller.serviceAccountName" -}}
{{- if .Values.controller.serviceAccount.create -}}
    {{ default (include "argo-cd.controller.fullname" .) .Values.controller.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.controller.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create dex name and version as used by the chart label.
*/}}
{{- define "argo-cd.dex.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.dex.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create Dex server endpoint
*/}}
{{- define "argo-cd.dex.server" -}}
{{- $insecure := index .Values.configs.params "dexserver.disable.tls" | toString -}}
{{- $scheme := (eq $insecure "true") | ternary "http" "https" -}}
{{- $host := include "argo-cd.dex.fullname" . -}}
{{- $port := int .Values.dex.servicePortHttp -}}
{{- printf "%s://%s:%d" $scheme $host $port }}
{{- end }}

{{/*
Create the name of the dex service account to use
*/}}
{{- define "argo-cd.dex.serviceAccountName" -}}
{{- if .Values.dex.serviceAccount.create -}}
    {{ default (include "argo-cd.dex.fullname" .) .Values.dex.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.dex.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create redis name and version as used by the chart label.
*/}}
{{- define "argo-cd.redis.fullname" -}}
{{- $redisHa := (index .Values "redis-ha") -}}
{{- $redisHaContext := dict "Chart" (dict "Name" "redis-ha") "Release" .Release "Values" $redisHa -}}
{{- if $redisHa.enabled -}}
    {{- if $redisHa.haproxy.enabled -}}
        {{- printf "%s-haproxy" (include "redis-ha.fullname" $redisHaContext) | trunc 63 | trimSuffix "-" -}}
    {{- end -}}
{{- else -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.redis.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Return Redis server endpoint
*/}}
{{- define "argo-cd.redis.server" -}}
{{- $redisHa := (index .Values "redis-ha") -}}
{{- if or (and .Values.redis.enabled (not $redisHa.enabled)) (and $redisHa.enabled $redisHa.haproxy.enabled) }}
    {{- printf "%s:%s" (include "argo-cd.redis.fullname" .)  (toString .Values.redis.servicePort) }}
{{- else if and .Values.externalRedis.host .Values.externalRedis.port }}
    {{- printf "%s:%s" .Values.externalRedis.host (toString .Values.externalRedis.port) }}
{{- end }}
{{- end -}}

{{/*
Create the name of the redis service account to use
*/}}
{{- define "argo-cd.redis.serviceAccountName" -}}
{{- if .Values.redis.serviceAccount.create -}}
    {{ default (include "argo-cd.redis.fullname" .) .Values.redis.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.redis.serviceAccount.name }}
{{- end -}}
{{- end -}}


{{/*
Create Redis secret-init name
*/}}
{{- define "argo-cd.redisSecretInit.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.redisSecretInit.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the Redis secret-init service account to use
*/}}
{{- define "argo-cd.redisSecretInit.serviceAccountName" -}}
{{- if .Values.redisSecretInit.serviceAccount.create -}}
    {{ default (include "argo-cd.redisSecretInit.fullname" .) .Values.redisSecretInit.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.redisSecretInit.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd server name and version as used by the chart label.
*/}}
{{- define "argo-cd.server.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.server.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the Argo CD server service account to use
*/}}
{{- define "argo-cd.server.serviceAccountName" -}}
{{- if .Values.server.serviceAccount.create -}}
    {{ default (include "argo-cd.server.fullname" .) .Values.server.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.server.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd repo-server name and version as used by the chart label.
*/}}
{{- define "argo-cd.repoServer.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.repoServer.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the repo-server service account to use
*/}}
{{- define "argo-cd.repoServer.serviceAccountName" -}}
{{- if .Values.repoServer.serviceAccount.create -}}
    {{ default (include "argo-cd.repoServer.fullname" .) .Values.repoServer.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.repoServer.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd application set name and version as used by the chart label.
*/}}
{{- define "argo-cd.applicationSet.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.applicationSet.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the application set service account to use
*/}}
{{- define "argo-cd.applicationSet.serviceAccountName" -}}
{{- if .Values.applicationSet.serviceAccount.create -}}
    {{ default (include "argo-cd.applicationSet.fullname" .) .Values.applicationSet.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.applicationSet.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Create argocd notifications name and version as used by the chart label.
*/}}
{{- define "argo-cd.notifications.fullname" -}}
{{- printf "%s-%s" (include "argo-cd.fullname" .) .Values.notifications.name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create the name of the notifications service account to use
*/}}
{{- define "argo-cd.notifications.serviceAccountName" -}}
{{- if .Values.notifications.serviceAccount.create -}}
    {{ default (include "argo-cd.notifications.fullname" .) .Values.notifications.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.notifications.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
Argo Configuration Preset Values (Influenced by Values configuration)
*/}}
{{- define "argo-cd.config.cm.presets" -}}
{{- $presets := dict -}}
{{- $_ := set $presets "url" (printf "https://%s" .Values.global.domain) -}}
{{- if eq (toString (index .Values.configs.cm "statusbadge.enabled")) "true" -}}
{{- $_ := set $presets "statusbadge.url" (printf "https://%s/" .Values.global.domain) -}}
{{- end -}}
{{- if .Values.configs.styles -}}
{{- $_ := set $presets "ui.cssurl" "./custom/custom.styles.css" -}}
{{- end -}}
{{- toYaml $presets }}
{{- end -}}

{{/*
Merge Argo Configuration with Preset Configuration
*/}}
{{- define "argo-cd.config.cm" -}}
{{- $config := omit .Values.configs.cm "create" "annotations" -}}
{{- $preset := include "argo-cd.config.cm.presets" . | fromYaml | default dict -}}
{{- range $key, $value := mergeOverwrite $preset $config }}
{{- $fmted := $value | toString }}
{{- if not (eq $fmted "") }}
{{ $key }}: {{ $fmted | toYaml }}
{{- end }}
{{- end }}
{{- end -}}

{{/*
Argo Params Default Configuration Presets
NOTE: Configuration keys must be stored as dict because YAML treats dot as separator
*/}}
{{- define "argo-cd.config.params.presets" -}}
{{- $presets := dict -}}
{{- $_ := set $presets "repo.server" (printf "%s:%s" (include "argo-cd.repoServer.fullname" .) (.Values.repoServer.service.port | toString)) -}}
{{- $_ := set $presets "server.repo.server.strict.tls" (.Values.repoServer.certificateSecret.enabled | toString ) -}}
{{- $_ := set $presets "redis.server" (include "argo-cd.redis.server" .) -}}
{{- $_ := set $presets "applicationsetcontroller.enable.leader.election" (gt ((.Values.applicationSet.replicas | default .Values.applicationSet.replicaCount) | int64) 1) -}}
{{- if .Values.dex.enabled -}}
{{- $_ := set $presets "server.dex.server" (include "argo-cd.dex.server" .) -}}
{{- $_ := set $presets "server.dex.server.strict.tls" .Values.dex.certificateSecret.enabled -}}
{{- end -}}
{{- range $component := tuple "applicationsetcontroller" "controller" "server" "reposerver" -}}
{{- $_ := set $presets (printf "%s.log.format" $component) $.Values.global.logging.format -}}
{{- $_ := set $presets (printf "%s.log.level" $component) $.Values.global.logging.level -}}
{{- end -}}
{{- toYaml $presets }}
{{- end -}}

{{/*
Merge Argo Params Configuration with Preset Configuration
*/}}
{{- define "argo-cd.config.params" -}}
{{- $config := omit .Values.configs.params "create" "annotations" }}
{{- $preset := include "argo-cd.config.params.presets" . | fromYaml | default dict -}}
{{- range $key, $value := mergeOverwrite $preset $config }}
{{ $key }}: {{ toString $value | toYaml }}
{{- end }}
{{- end -}}

{{/*
Expand the namespace of the release.
Allows overriding it for multi-namespace deployments in combined charts.
*/}}
{{- define "argo-cd.namespace" -}}
{{- default .Release.Namespace .Values.namespaceOverride | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Dual stack definition
*/}}
{{- define "argo-cd.dualStack" -}}
{{- with .Values.global.dualStack.ipFamilyPolicy }}
ipFamilyPolicy: {{ . }}
{{- end }}
{{- with .Values.global.dualStack.ipFamilies }}
ipFamilies: {{ toYaml . | nindent 4 }}
{{- end }}
{{- end }}
