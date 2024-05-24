


pipeline {
    agent {
        label "build_slave_agtool"
    }

    environment {
        app_name = "mar"
        deployment = "dev"
        ssh_credential_id = "capwiki_deployment_keys"
        deploy_user = "capwiki"
        target_dir = "/home/$deploy_user/$app_name"
        remote_host = "10.44.100.255"
        appimage = ""
        BRANCH = "${params.BRANCH}"
        CREDENTIALS_ID = "production_line_service_account"
        REPO_URL = "https://pt-support-shared.pl.s2-eu.capgemini.com/gitlab/tpo-bu-germany/mar.git"
        DOCKER_REGISTRY = "docker-registry-pt-support-shared.pl.s2-eu.capgemini.com"
        IMAGE = "${DOCKER_REGISTRY}/tpo-bu-germany/${app_name}:${params.VERSION}-${deployment}"
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
        stage("Build images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        // Read the Docker config.json file ${env.HOME}/workspace/TPO BU Germany/MAR-Project/MAR-Pipeline@2@tmp/a29f3d38-1ccb-4de5-beeb-517c4b65ce51/config.json
                         sh '''
                            echo "Listing contents of the home directory on the Jenkins agent:"
                             def homeDirectoryContents = sh(script: 'cd "${env.HOME}/workspace/TPO BU Germany/MAR-Project/MAR-Pipeline@2@tmp"', returnStdout: true).trim()
                             echo "Listing contents of the home directory on the Jenkins agent:"
                             echo homeDirectoryContents
                        '''
                       
                      /*
                        def configFile = readFile("${env.HOME}/workspace/TPO BU Germany/MAR-Project/MAR-Pipeline@2@tmp/a29f3d38-1ccb-4de5-beeb-517c4b65ce51/config.json")
                        echo "Home ${env.HOME} Docker configFile1.json content: ${configFile}"*/
                      
                        /*appimage = docker.build("${IMAGE}")*/
                        
                    }
                }
            }
        }
/*
        stage("Push images") {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", "production_line_service_account") {
                        appimage.push()
                    }
                }
            }
        }
*/
        stage("Deploy to Kubernetes on remote vm via SSH") {
            steps {
                script {
                    def imageVersion = 2.4
                    
                    sshagent(["${ssh_credential_id}"]) {
                   
                        sh '''
                          echo 'in ssh agent ${target_dir}'
                          pwd
                          # to remove existing helm charts diretory
                          #ssh ${deploy_user}@${remote_host} "rm -rf ${target_dir}/helm/*" 
                          # to copy helm charts diretory into remote vm
                          #rsync -avzi -e "ssh -o StrictHostKeyChecking=accept-new" dev/helm  ${deploy_user}@${remote_host}:${target_dir}
                           
                          ssh -o StrictHostKeyChecking=accept-new ${deploy_user}@${remote_host} '  
                            ls  
                            microk8s status
                            microk8s helm version
                            cd ./${target_dir}/mar/helm                               
                            pwd
                            microk8s helm list
                            /*
                             set below image.repository=${DOCKER_REGISTRY}/{IMAGE}
                             */
                           /* microk8s helm upgrade --install wiki . -f values.yaml --set image.repository=requarks/wiki:{imageVersion}*/
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
