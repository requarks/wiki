<div align="center">

<img src="https://static.requarks.io/logo/wikijs-full.svg" alt="Wiki.js" width="600" />

[![Release](https://img.shields.io/github/release/Requarks/wiki.svg?style=flat&maxAge=3600)](https://github.com/Requarks/wiki/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Backers on Open Collective](https://opencollective.com/wikijs/all/badge.svg)](https://opencollective.com/wikijs)
[![Downloads](https://img.shields.io/github/downloads/Requarks/wiki/total.svg?style=flat)](https://github.com/Requarks/wiki/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/requarks/wiki.svg)](https://hub.docker.com/r/requarks/wiki/)  
[![Build status](https://dev.azure.com/requarks/wiki/_apis/build/status/build)](https://dev.azure.com/requarks/wiki/_build/latest?definitionId=9)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=alert_status)](https://sonarcloud.io/dashboard?id=wiki)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=wiki)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=security_rating)](https://sonarcloud.io/dashboard?id=wiki)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)  
[![Chat on Slack](https://img.shields.io/badge/slack-requarks-CC2B5E.svg?style=flat&logo=slack)](https://wiki.requarks.io/slack)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat&logo=twitter)](https://twitter.com/requarks)
[![Subscribe to Newsletter](https://img.shields.io/badge/newsletter-subscribe-yellow.svg?style=flat&logo=mailchimp)](https://wiki.js.org/newsletter)

##### A modern, lightweight and powerful wiki app built on NodeJS

</div>

- **[Official Website](https://wiki.js.org/)**
- **[Documentation](https://docs.requarks.io/)**

<h2 align="center">Donate</h2>

<div align="center">

Wiki.js is an open source project that has been made possible due to the generous contributions by community [backers](https://wiki.js.org/about). If you are interested in supporting this project, please consider [becoming a sponsor](https://github.com/users/NGPixel/sponsorship), [becoming a patron](https://www.patreon.com/requarks), donating to our [OpenCollective](https://opencollective.com/wikijs), via [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url) or via Ethereum (`0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5`).
  
  [![Become a Sponsor](https://img.shields.io/badge/donate-github-ea4aaa.svg?style=popout&logo=github)](https://github.com/users/NGPixel/sponsorship)
  [![Become a Patron](https://img.shields.io/badge/donate-patreon-orange.svg?style=popout&logo=patreon)](https://www.patreon.com/requarks)
  [![Donate on OpenCollective](https://img.shields.io/badge/donate-open%20collective-blue.svg?style=popout&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIHdpZHRoPSIyNTZweCIgaGVpZ2h0PSIyNTZweCIgdmlld0JveD0iMCAwIDI1NiAyNTYiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQiPjxnPjxwYXRoIGQ9Ik0yMDkuNzY1MTQ0LDEyOC4xNDk5NzkgQzIwOS43NjUxNDQsMTQ0LjE2MzMgMjA0Ljg2NDM4MSwxNTkuNDg5ODkgMTk2LjQ5ODc0NywxNzIuNzI1MDcyIEwyMjkuOTQ1Njc1LDIwNi4xNzE5OTkgQzI0Ni42ODIxMDUsMTgzLjg1Njc1OSAyNTUuNzI5MzA3LDE1Ni43MTUxNTIgMjU1LjcyOTMwNywxMjguODIxMTAyIEMyNTUuNzI5MzA3LDk5LjU1Njk5MTcgMjQ1Ljk3NDYwMyw3My4wNzEwMjA3IDIyOS4yNTg5NDQsNTEuNDg1ODEyOCBMMTk2LjQ4MzE0LDg0LjIxNDc5NCBDMjA1LjEyMjU2MSw5Ny4yMjI0NjgzIDIwOS43MzY5MDcsMTEyLjQ4NzgxIDIwOS43NDk1MzcsMTI4LjEwMzE1NiBMMjA5Ljc2NTE0NCwxMjguMTQ5OTc5IFoiIGZpbGw9IiNCOEQzRjQiPjwvcGF0aD48cGF0aCBkPSJNMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEM4Mi4xNDYwODcyLDIxMC4yNjg5NTggNDUuMzg3NTA5NCwxNzMuNTE3MzU4IDQ1LjI5MzAzOTMsMTI4LjE0OTk3OSBDNDUuMzYxNzUwMiw4Mi43NjQzMTM4IDgyLjEyNzg0ODcsNDUuOTg0MjU3IDEyNy41MTM0ODQsNDUuODk4MzE4NiBDMTQ0LjI0NDc1Miw0NS44OTgzMTg2IDE1OS41NzEzNDIsNTAuNzk5MDgxNyAxNzIuMTE5NzkyLDU5LjE2NDcxNTQgTDIwNC44NjQzODEsMjYuMzg4OTExNiBDMTgyLjU0MzY1LDkuNjY2NjUxMjkgMTU1LjQwMzQyOSwwLjYzMDg2MzI5OCAxMjcuNTEzNDg0LDAuNjM2NDk0NDAzIEM1Ny4xMjM1NDM3LDAuNjM2NDk0NDAzIDAsNTcuNzYwMDM4MSAwLDEyOC4xNDk5NzkgQzAsMTk4LjUwODcwNCA1Ny4xMjM1NDM3LDI1NS42NjM0NjMgMTI3LjUxMzQ4NCwyNTUuNjYzNDYzIEMxNTUuNTM3MzUyLDI1NS43NDA4NzYgMTgyLjc3NTk4OSwyNDYuNDA4NTEgMjA0Ljg2NDM4MSwyMjkuMTYxODg0IEwxNzEuNDE3NDU0LDE5NS43MzA1NjQgQzE1OS41NTU3MzQsMjA1LjQ4NTI2OCAxNDQuMjYwMzU5LDIxMC4zNTQ4MTYgMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEwxMjcuNTEzNDg0LDIxMC4zNTQ4MTYgWiIgZmlsbD0iIzdGQURGMiI+PC9wYXRoPjwvZz48L3N2Zz4=)](https://opencollective.com/wikijs)
  [![Donate via Paypal](https://img.shields.io/badge/donate-paypal-blue.svg?style=popout&logo=paypal)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url)  
  [![Donate via Ethereum](https://img.shields.io/badge/donate-ethereum-999.svg?style=popout&logo=ethereum&logoColor=CCC)](https://etherscan.io/address/0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5)
  [![Donate via Bitcoin](https://img.shields.io/badge/donate-bitcoin-ff9900.svg?style=popout&logo=bitcoin&logoColor=CCC)](https://checkout.opennode.com/p/2553c612-f863-4407-82b3-1a7685268747)
  [![Buy a T-Shirt](https://img.shields.io/badge/buy-t--shirts-teal.svg?style=popout&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHg9IjBweCIgeT0iMHB4Igp3aWR0aD0iMjQiIGhlaWdodD0iMjQiCnZpZXdCb3g9IjAgMCAxOTIgMTkyIgpzdHlsZT0iIGZpbGw6IzAwMDAwMDsiPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0ibm9uemVybyIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIGZvbnQtZmFtaWx5PSJub25lIiBmb250LXdlaWdodD0ibm9uZSIgZm9udC1zaXplPSJub25lIiB0ZXh0LWFuY2hvcj0ibm9uZSIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0wLDE5MnYtMTkyaDE5MnYxOTJ6IiBmaWxsPSJub25lIj48L3BhdGg+PGcgZmlsbD0iIzFhYmM5YyI+PGcgaWQ9InN1cmZhY2UxIj48cGF0aCBkPSJNOTYsMGMtMTUuMjE4NzUsMCAtMjQuNjg3NSwzLjY1NjI1IC0yNS41LDRsLTIyLjUsNy4yNWMtMTAuNDA2MjUsMy4xODc1IC0xOS4wOTM3NSw5LjQzNzUgLTI1LjUsMTguMjVsLTIyLjUsNDIuNWwyNy4yNSwxNi43NWwxMi43NSwtMjR2MTE5LjI1YzAsNC40MDYyNSAyNS4wNjI1LDggNTYsOGMzMC45Mzc1LDAgNTYsLTMuNTkzNzUgNTYsLTh2LTExOS4yNWwxMi43NSwyNGwyNy4yNSwtMTYuNzVsLTIyLjUsLTQyLjVjLTYuNDA2MjUsLTguODEyNSAtMTUuMTU2MjUsLTE1LjA2MjUgLTI0Ljc1LC0xOC4yNWwtMjIuMjUsLTcuMjVjLTAuMTg3NSwwIC0xLjAzMTI1LDEuMzEyNSAtMiwyLjc1bDEuMjUsLTIuNWMwLDAgLTkuODQzNzUsLTQuMjUgLTI1Ljc1LC00LjI1ek05Niw4YzExLjQwNjI1LDAgMTguNDM3NSwyLjI1IDIxLDMuMjVjLTQuNDY4NzUsNS43NSAtMTEuNDA2MjUsMTIuNzUgLTIxLDEyLjc1Yy05LjQwNjI1LDAgLTE2LjQwNjI1LC03LjA2MjUgLTIwLjc1LC0xMi43NWMyLjg3NSwtMS4wNjI1IDkuODc1LC0zLjI1IDIwLjc1LC0zLjI1eiI+PC9wYXRoPjwvZz48L2c+PC9nPjwvc3ZnPg==)](https://wikijs.threadless.com)

</div>

## Introduction

This chart bootstraps a Wiki.js deployment on a [Kubernetes](http://kubernetes.io) cluster using the [Helm](https://helm.sh) package manager.

It also optionally packages the [PostgreSQL](https://github.com/kubernetes/charts/tree/master/stable/postgresql) as the database but you are free to bring your own.

## Prerequisites

- PV provisioner support in the underlying infrastructure (with persistence storage enabled) if you want data persistance

## Adding the Wiki.js Helm Repository

```console
$ helm repo add requarks https://charts.js.wiki
```

## Installing the Chart

To install the chart with the release name `my-release` run the following:

### Using Helm 3:
```console
$ helm install my-release requarks/wiki
```
### Using Helm 2:
```console
$ helm install --name my-release requarks/wiki
```

The command deploys Wiki.js on the Kubernetes cluster in the default configuration. The [configuration](#configuration) section lists the parameters that can be configured during installation.

> **Tip**: List all releases using `helm list`

## Uninstalling the Chart

To uninstall/delete the `my-release` deployment:

```console
$ helm delete my-release
```

The command removes all the Kubernetes components associated with the chart and deletes the release.

> **Warning**: Persistant Volume Claims for the database are not deleted automatically. They need to be manually deleted

```console
$ kubectl delete pvc/data-wiki-postgresql-0
```

## Configuration

The following table lists the configurable parameters of the Wiki.js chart and their default values.

| Parameter                            | Description                                 | Default                                                    |
| -------------------------------      | -------------------------------             | ---------------------------------------------------------- |
| `image.repository`                   | Wiki.js image                                | `requarks/wiki`                                           |
| `image.tag`                          | Wiki.js image tag                            | `latest`                                                      |
| `imagePullPolicy`                    | Image pull policy                           | `IfNotPresent`                                             |
| `replicacount`                   | Amount of wiki.js service pods to run                   | `1`                                                        |
| `resources.limits`               | wiki.js service resource limits                         | `nil`                               |
| `resources.requests`             | wiki.js service resource requests                       | `nil`                               |
| `nodeSelector`                   | Node labels for wiki.js pod assignment          | `{}`                                                       |
| `affinity`                       | Affinity settings for wiki.js pod assignment    | `{}`                                                       |
| `schedulerName`                  | Name of an alternate scheduler for wiki.js pod  | `nil`                                                      |
| `tolerations`                    | Toleration labels for wiki.jsk pod assignment    | `[]`                                                       |
| `ingress.enabled`                    | Enable ingress controller resource          | `false`                                                    |
| `ingress.annotations`                | Ingress annotations                         | `{}`                                                       |
| `ingress.hosts`                      | List of ingress rules                        | `[{"host": "wiki.local", "paths": ["/"]}]`                |
| `ingress.tls`                        | Ingress TLS configuration                   | `[]`                                                       |
| `sideload.enabled`                   | Enable sideloading of locale files from git | `false`                                                    |
| `sideload.repoURL`                   | Git repository URL containing locale files  | `https://github.com/Requarks/wiki-localization`            |
| `sideload.env`                       | Environment variables for sideload Container | `{}`                                                      |
| `postgresql.enabled`                 | Deploy postgres server (see below)          | `true`                                                     |
| `postgresql.postgresqlDatabase`        | Postgres database name                      | `wiki`                                                   |
| `postgresql.postgresqlUser`            | Postgres username                           | `postgres`                                                   |
| `postgresql.postgresqlHost`            | External postgres host                      | `nil`                                                      |
| `postgresql.postgresqlPassword`        | External postgres password                  | `nil`                                                      |
| `postgresql.existingSecret`            | Provide an existing `Secret` for postgres   | `nil`                                                      |
| `postgresql.existingSecretKey`          | The postgres password key in the existing `Secret`   | `postgresql-password`                              |
| `postgresql.postgresqlPort`            | External postgres port                      | `5432`                                                     |
| `postgresql.ssl`                       | Enable external postgres SSL connection     | `false`                                                   |
| `postgresql.ca`                        | Certificate of Authority content for postgres  | `nil`                                                     |
| `postgresql.persistence.enabled`                | Enable postgres persistence using PVC                | `true`                                                     |
| `postgresql.persistence.existingClaim`          | Provide an existing `PersistentVolumeClaim` for postgres | `nil`                                                      |
| `postgresql.persistence.storageClass`           | Postgres PVC Storage Class (example: `nfs`)                           | `nil`                 |
| `postgresql.persistence.size`                   | Postgers PVC Storage Request                         | `8Gi`                                                     |

Specify each parameter using the `--set key=value[,key=value]` argument to `helm install`. For example,

```console
$ helm install --name my-release \
  --set postgresql.persistence.enabled=false \
   requarks/wiki
```

Alternatively, a YAML file that specifies the values for the above parameters can be provided while installing the chart. For example,

```console
$ helm install --name my-release -f values.yaml requarks/wiki
```

> **Tip**: You can use the default [values.yaml](values.yaml)

## PostgresSQL

By default, PostgreSQL is installed as part of the chart.

### Using an external PostgreSQL server

To use an external PostgreSQL server, set `postgresql.enabled` to `false` and then set `postgresql.postgresqlHost` and `postgresql.postgresqlPassword`. To use an existing `Secret`, set `postgresql.existingSecret`. The other options (`postgresql.postgresqlDatabase`, `postgresql.postgresqlUser`, `postgresql.postgresqlPort` and `postgresql.existingSecretKey`) may also want changing from their default values.

To use an SSL connection you can set `postgresql.ssl` to `true` and if needed the path to a Certificate of Authority can be set using `postgresql.ca` to `/path/to/ca`. Default `postgresql.ssl` value is `false`.

If `postgresql.existingSecret` is not specified, you also need to add the following Helm template to your deployment in order to create the postgresql `Secret`:

```yaml
kind: Secret
apiVersion: v1
metadata:
  name: {{ template "wiki.postgresql.secret" . }}
data:
  {{ template "wiki.postgresql.secretKey" . }}: "{{ .Values.postgresql.postgresqlPassword | b64enc }}"
```

## Persistence

Persistent Volume Claims are used to keep the data across deployments. This is known to work in GCE, AWS, and minikube.
See the [Configuration](#configuration) section to configure the PVC or to disable persistence.

## Ingress

This chart provides support for Ingress resource. If you have an available Ingress Controller such as Nginx or Traefik you maybe want to set `ingress.enabled` to true and add `ingress.hosts` for the URL. Then, you should be able to access the installation using that address.
