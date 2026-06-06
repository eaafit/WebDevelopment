{{- define "notary-portal.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "notary-portal.fullname" -}}
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

{{- define "notary-portal.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/name: {{ include "notary-portal.name" . | quote }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
app.kubernetes.io/part-of: {{ .Values.global.partOf | quote }}
app.kubernetes.io/environment: {{ .Values.global.environment | quote }}
{{- end -}}

{{- define "notary-portal.componentLabels" -}}
{{ include "notary-portal.labels" .root }}
app.kubernetes.io/component: {{ .component | quote }}
{{- end -}}

{{- define "notary-portal.selectorLabels" -}}
app.kubernetes.io/name: {{ include "notary-portal.name" .root | quote }}
app.kubernetes.io/instance: {{ .root.Release.Name | quote }}
app.kubernetes.io/component: {{ .component | quote }}
{{- end -}}

{{- define "notary-portal.image" -}}
{{- $pullPolicy := default .root.Values.global.imagePullPolicy .image.pullPolicy -}}
image: "{{ .image.repository }}:{{ .image.tag | default .root.Chart.AppVersion }}"
imagePullPolicy: {{ $pullPolicy }}
{{- end -}}

{{- define "notary-portal.secretName" -}}
{{- .Values.secret.name | default (printf "%s-secret" (include "notary-portal.fullname" .)) -}}
{{- end -}}

{{- define "notary-portal.apiServiceAccountName" -}}
{{- if .Values.api.serviceAccount.name -}}
{{- .Values.api.serviceAccount.name -}}
{{- else -}}
{{- printf "%s-api" (include "notary-portal.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "notary-portal.webServiceAccountName" -}}
{{- if .Values.web.serviceAccount.name -}}
{{- .Values.web.serviceAccount.name -}}
{{- else -}}
{{- printf "%s-web" (include "notary-portal.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "notary-portal.migrateServiceAccountName" -}}
{{- if .Values.migrations.serviceAccount.name -}}
{{- .Values.migrations.serviceAccount.name -}}
{{- else -}}
{{- printf "%s-migrate" (include "notary-portal.fullname" .) -}}
{{- end -}}
{{- end -}}
