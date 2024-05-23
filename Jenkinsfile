


pipeline {
    agent {
        label "build_slave_agtool"
    }

    environment {
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = "production_line_service_account"
        REPO_URL = "https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git"
        DOCKER_REGISTRY = "docker-registry-pt-support-shared.pl.s2-eu.capgemini.com"
        IMAGE = "${DOCKER_REGISTRY}/tpo-bu-germany/${app_name}:${params.VERSION}-${deployment}"
        app_name = "mar"
        deployment = "dev"
        ssh_credential_id = "capwiki_deployment_keys"
        deploy_user = "capwiki"
        target_dir = "/home/$deploy_user/$app_name"
        remote_host = "10.44.100.255"
        image = ""
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

       /*
         @TODO Need to adjust Dockerfile in dev/build
         docker.build("my-image:${env.BUILD_ID}", "-f ${dockerfile} ./dockerfiles")
       */
     /*   stage("Build images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        app = docker.build("${IMAGE}", "-f ./Dockerfile ./")
                    }
                }
            }
        }

        stage("Push images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        app.push()
                    }
                }
            }
        }
*/
        stage("Deploy to Kubernetes on remote vm via SSH") {
            steps {
                script {
                    sshagent(["${ssh_credential_id}"]) {
                   
                        sh '''
                          echo 'in ssh agent ${target_dir}'
                          ls
                          ssh -o StrictHostKeyChecking=accept-new ${deploy_user}@${remote_host} '    
                   
                          if [ -d $target_dir ]; then
                              # Inner if condition
                              if [ ! -d $target_dir/helm ]; then
                                  sudo mkdir -p $target_dir/helm
                                  rsync -i -z dev/helm ${deploy_user}@${remote_host}:${target_dir}/helm   
                                  pwd
                                  cd ./helm                               
                                  ls
                              else
                                  echo "helm directory not found"
                              fi
                                       
                            microk8s status
                            microk8s helm version
                          fi  
                          '
                        '''
                        /**
                         * @TODO To add
                         * helm upgrade install chart and send pass built image as param
                         *    helm upgrade --install
                         *     --set image.repository=${IMAGE}
                        *
                        **/
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
