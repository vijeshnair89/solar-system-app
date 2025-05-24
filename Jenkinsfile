pipeline {
    agent any   
    
    tools {  
        nodejs 'nodejs' 
    }
     
    environment {
        NVD_API_KEY = credentials('nvd-api-key-id') 
        SCANNER_HOME   = tool 'sonar-scanner'
        MONGO_URI = credentials('mongo_url')
        MONGO_USERNAME  = credentials('mongo_user')
        MONGO_PASSWORD   = credentials('mongo_pwd') 
        GITHUB_TOKEN = credentials('github-token')
        APP_SERVER = credentials('server-ip')
        s3_bucket = credentials('s3-bucket')
    }

    stages {

        stage('node version') {
            steps {
                sh '''
                node -v
                npm -v
                '''
            }
        }

        stage('Get Commit SHA') {
            steps {
                script {
                    // Get short commit SHA from git
                    COMMIT_ID = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.COMMIT_ID = COMMIT_ID
                    echo "Using commit SHA: ${COMMIT_ID}"
                }
            }
        }
        
        stage('install dependency') {
            steps {
                sh 'npm install --no-audit'
            }
        }
         
        stage("Dependency Checks") {
            parallel {
                stage("dependency check using npm") {
                    steps {
                        sh 'npm audit --audit-level=critical'
                        sh 'echo $?'
                    }
                }
                stage("owasp dependency check") {
                    steps {
                        dependencyCheck additionalArguments: ''' 
                        --scan ./ \
                        --out ./ \
                        --format ALL \
                        --prettyPrint \
                        --disableYarnAudit \
                        --nvdApiKey ${NVD_API_KEY}
                        ''', odcInstallation: 'dp-check'
                    }
                }
            }
        }
                
        stage('unit test') {
            when {
                branch "feature-*"
            }
            steps {
                sh 'npm test'
            }
        }
        
        stage('code coverage') {
            steps {
                catchError(buildResult: 'SUCCESS', message: 'Oops! This coverage feature issue will be fixed in the next release!!', stageResult: 'UNSTABLE') {
                    sh 'npm run coverage'
                }
            }
        }
        
        stage('SAST-Quality Check') {
            steps {
                timeout(time: 60, unit: 'SECONDS') {
                    withSonarQubeEnv('sonar-server') {
                        sh '''
                            $SCANNER_HOME/bin/sonar-scanner \
                              -Dsonar.projectKey=solar-system \
                              -Dsonar.sources=app.js \
                              -Dsonar.javascript.lcov.reportPaths=./coverage/lcov.info 
                        '''
                    }
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Build the image') {
            steps {
                sh "docker build -t vijesh89/solar-system:${COMMIT_ID} ."
            }
        }
        
        stage('Scan the image') {
            steps {
                sh '''
                    trivy image vijesh89/solar-system:${COMMIT_ID} \
                    --severity MEDIUM,LOW,UNKNOWN,HIGH \
                    --exit-code 0 \
                    --quiet \
                    --format json -o trivy-scan-LOW-MEDIUM-HIGH-report.json
                    
                    trivy image vijesh89/solar-system:${COMMIT_ID} \
                    --severity CRITICAL \
                    --exit-code 1 \
                    --quiet \
                    --format json -o trivy-scan-CRITICAL-report.json
                '''
            }
            post {
                always {
                    sh '''
                        trivy convert --format template --template @/usr/local/share/trivy/templates/html.tpl \
                        -o trivy-scan-LOW-MEDIUM-HIGH-report.html trivy-scan-LOW-MEDIUM-HIGH-report.json
                        
                        trivy convert --format template --template @/usr/local/share/trivy/templates/junit.tpl \
                        -o trivy-scan-LOW-MEDIUM-HIGH-report.xml trivy-scan-LOW-MEDIUM-HIGH-report.json
                        
                        trivy convert --format template --template @/usr/local/share/trivy/templates/html.tpl \
                        -o trivy-scan-CRITICAL-report.html trivy-scan-CRITICAL-report.json
                        
                        trivy convert --format template --template @/usr/local/share/trivy/templates/junit.tpl \
                        -o trivy-scan-CRITICAL-report.xml trivy-scan-CRITICAL-report.json
                    '''
                }
            }
        }
        
        stage('Push the Image') {
            steps {
                withDockerRegistry(credentialsId: 'docker-creds', url: 'https://index.docker.io/v1/') {
                    sh 'docker push vijesh89/solar-system:${COMMIT_ID}'   
                }
            }
        }
        
        stage('Deploy to App Server') {
            when {
                branch "feature-*"
            }
            steps {
                script {
                    sshagent(['app-server-private-key']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ubuntu@${APP_SERVER} "
                                if sudo docker ps -a | grep -i "solar-system" ; then
                                    echo "Container found... Stopping and removing"
                                        sudo docker stop "solar-system" && sudo docker rm "solar-system"
                                    echo "Container Stopped and removed"
                                fi
                                echo "Deploying a new container"
                                sudo docker run -d \
                                    --name solar-system \
                                    -e MONGO_URI=${MONGO_URI} \
                                    -e MONGO_USERNAME=${MONGO_USERNAME} \
                                    -e MONGO_PASSWORD=${MONGO_PASSWORD} \
                                    -p 3000:3000 vijesh89/solar-system:${COMMIT_ID}
                            "
                        """
                    }
                }
            }
        }

        stage('Create PR to main') {
            when {
                branch "feature-*"
            }
            steps {
                script {
                    def branchName = env.BRANCH_NAME
                    def owner = "vijeshnair89" // Replace with actual owner
                    def repo = "solar-system-app" // Replace with actual repo name
        
                    sh """
                        curl -L \
                          -X POST \
                          -H "Accept: application/vnd.github+json" \
                          -H "Authorization: Bearer ${GITHUB_TOKEN}" \
                          -H "X-GitHub-Api-Version: 2022-11-28" \
                          https://api.github.com/repos/${owner}/${repo}/pulls \
                          -d '{
                            "title": "Merge ${branchName} into main",
                            "body": "Automated pull request created by Jenkins pipeline.",
                            "head": "${branchName}",
                            "base": "main"
                          }'
                    """
                }
            }
        }

        stage('Upload AWS-S3'){
            steps{
                withAWS(credentials: 'aws-ec2-access-creds', region: 'us-east-1') {
                    sh '''
                       ls -lrt
                       mkdir reports-${BRANCH_NAME}-build-${BUILD_NUMBER}
                       cp -rf coverage/ reports-${BRANCH_NAME}-build-${BUILD_NUMBER}
                       cp test-results.xml dependency*.* trivy*.* reports-${BRANCH_NAME}-build-${BUILD_NUMBER}
                       ls -ltr reports-${BRANCH_NAME}-build-${BUILD_NUMBER}
                    '''
                    s3Upload(
                        file: "reports-${BRANCH_NAME}-build-${BUILD_NUMBER}",
                        path: "jenkins-${JOB_NAME}/${BRANCH_NAME}-build-${BUILD_NUMBER}",
                        bucket: "${s3_bucket}"
                    )
                }
            }
        }

        stage("Update k8s image") {
            when {
                branch "main"
            }
            steps {
                script {
                    def repoUrl = "https://github.com/vijeshnair89/kubernetes-manifests.git"
                    def repoDir = "kubernetes-manifests"
                    def subDir = "solar-system-app"
                    // Get current commit SHA for main branch build
                    def imageTag = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        
                    withCredentials([gitUsernamePassword(credentialsId: 'github-creds', gitToolName: 'Default')]) {
                        if (!fileExists(repoDir)) {
                            echo "Cloning repository..."
                            sh "git clone -b main ${repoUrl} ${repoDir}"
                        } else {
                            echo "Repository exists. Pulling latest changes..."
                            dir("${repoDir}") {
                                sh '''
                                    git reset --hard
                                    git checkout main
                                    git pull
                                '''
                            }
                        }
        
                        // Update image tag and push
                        dir("${repoDir}/${subDir}") {
                            sh """
                                sed -i 's@vijesh89.*@vijesh89/solar-system:${imageTag}@g' deployment.yml
                                echo "Updated deployment.yml:"
                                cat deployment.yml
        
                                git config --global user.email "vijesh@example.com"
                                git config --global user.name "Vijesh"
                                git add .
                                git commit -m "Updated deploy.yaml with image tag ${imageTag}" || echo "No changes to commit"
                                git push origin main
                            """
                        }
                    }
                }
            }
        }
    }
    
    post {
      always {
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'dependency-check-jenkins.html', reportName: 'Dependency Check HTML Report', reportTitles: '', useWrapperFileDirectly: true])
        dependencyCheckPublisher failedTotalCritical: 1, pattern: 'dependency-check-report.xml', skipNoReportFiles: true, stopBuild: true
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: 'coverage/lcov-report', reportFiles: 'index.html', reportName: 'Code Coverage Report', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-CRITICAL-report.html', reportName: 'Trivy scan critical vuln', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-LOW-MEDIUM-HIGH-report.html', reportName: 'Trivy scan low medium high vuln', reportTitles: '', useWrapperFileDirectly: true])
        
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'dependency-check-junit.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'test-results.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-CRITICAL-report.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-LOW-MEDIUM-HIGH-report.xml'
      }
    }
}
