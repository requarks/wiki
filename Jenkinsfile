


pipeline {
    agent {
        label "build_slave_agtool"
    }
     
    environment {
        project_name = "mar"
        app_name = "capwiki"
        deployment = "dev"
        ssh_credential_id = "capwiki_deployment_keys"
        deploy_user = "capwiki"
        target_dir = "/home/$deploy_user/$project_name"
        remote_host = "10.44.100.255"
        appimage = ""
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = "production_line_service_account"
        REPO_URL = "https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git"
        DOCKER_REGISTRY = "docker-registry-pt-support-shared.pl.s2-eu.capgemini.com"
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        IMAGE = "${DOCKER_REGISTRY}/${project_name}/${app_name}:${params.VERSION}-${deployment}"
    }

    parameters {
        gitParameter branchFilter: "origin/(.*)", defaultValue: "main", name: "BRANCH", type: "PT_BRANCH"
        string(name: "VERSION", defaultValue: "latest", description: "Specify the version for the images.")
    }

    tools {
        nodejs "nodejs-18.13.0"
    }

    options {
        gitLabConnection("PT-Support-Gitlab")
    }

    stages {
        stage("Git checkout stage") {
            steps {
                git branch: "${BRANCH}", credentialsId: "${CREDENTIALS_ID}", url: "${REPO_URL}"
            }
        }

       /* stage("Run Tests") {
            steps {
                echo "Unit Tests: DONE"
            }
        }*/

       
        stage("Build images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        appimage = docker.build("${IMAGE}")  
                    }
                }
            }
        }

        stage("Push images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        appimage.push()
                    }
                }
            }
        }

        stage("Deploy to Kubernetes on remote vm via SSH") {
            steps {
                script {
                    
                    sshagent(["${ssh_credential_id}"]) {
                   
                        sh '''
                          echo 'in ssh agent ${target_dir}'
                          pwd
                          # to remove existing helm charts diretory
                          ssh ${deploy_user}@${remote_host} "rm -rf ${target_dir}/helm/*" 
                          # to copy helm charts diretory into remote vm
                           rsync -avzi -e "ssh -o StrictHostKeyChecking=accept-new" dev/helm  ${deploy_user}@${remote_host}:${target_dir}
                           
                          ssh -o StrictHostKeyChecking=accept-new ${deploy_user}@${remote_host} '  
                            ls  
                            microk8s status
                            microk8s helm version
                            cd ./${target_dir}/mar/helm                               
                            pwd
                            microk8s helm list
                             
                            microk8s helm upgrade --install wiki . -f values.yaml --set image.repository=docker-registry-pt-support-shared.pl.s2-eu.capgemini.com/mar/capwiki,image.tag=latest-dev
                             
                            microk8s helm history wiki
                          '
                        '''
                }
                
            }
        }
    }
   
}
    post {
            always {
                cleanWs()
            }
            success {
                echo "Pipeline completed successfully."
            }
            failure {
                echo "Pipeline failed."
            }
    }
}
