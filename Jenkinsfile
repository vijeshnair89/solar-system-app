pipeline {
    agent any
    
    tools {
        nodejs 'nodejs'
    }
    
    environment {
        REPO_OWNER="vijeshnair89"
        REPO_NAME="solar-system-app"
        BASE_BRANCH="main"
        PR_TITLE="Merge code"
        PR_BODY="Merge changes from feature to main"
        MONGO_URI = credentials('mongo_url')
        MONGO_USERNAME  = credentials('mongo_user')
        MONGO_PASSWORD   = credentials('mongo_pwd') 
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
        
        stage('install dependency') {
            steps {
                sh 'npm install --no-audit'
            }
        }
        
      
          
        stage("dependency check using npm"){
            steps{
                sh 'npm audit --audit-level=critical'
                sh 'echo $?'
            }
        }
                
        
        
        stage('Build the image') {
            steps {
                sh "docker build -t vijesh89/solar-system:${BUILD_ID} ."
            }
        }
        
        stage('Scan the image') {
            steps {
                sh '''
                    trivy image vijesh89/solar-system:${BUILD_ID} \
                    --severity MEDIUM,LOW,UNKNOWN,HIGH \
                    --exit-code 0 \
                    --quiet \
                    --format json -o trivy-scan-LOW-MEDIUM-HIGH-report.json
                    
                    trivy image vijesh89/solar-system:${BUILD_ID} \
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
                    sh 'docker push vijesh89/solar-system:${BUILD_ID}'   
                }
            }
        }
        
        stage("Update k8s image") {
            steps {
                script {
                    def repoUrl = "https://github.com/vijeshnair89/kubernetes-manifests.git"
                    def repoDir = "kubernetes-manifests"
                    def subDir = "solar-system-app"
        
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
                                sed -i 's@vijesh89.*@vijesh89/solar-system:${BUILD_ID}@g' deployment.yml
                                echo "Updated deployment.yml:"
                                cat deployment.yml
        
                                git config --global user.email "vijesh@example.com"
                                git config --global user.name "Vijesh"
                                git add .
                                git commit -m "Updated deploy.yaml with image tag ${BUILD_ID}" || echo "No changes to commit"
                                git push origin main
                            """
                        }
                    }
                }
            }
        }
        
        stage('Create PR to main'){
            when{
                branch 'feature'
            }
            steps{
                sh '''
                    curl -s -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
                    -d "{\"title\":\"${PR_TITLE}\", \"head\":\"${BRANCH_NAME}\", \
                    \"base\":\"${BASE_BRANCH}\", \"body\":\"${PR_BODY}\"}" \
                    https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls
                '''
            }
        }
        
        stage('Upload AWS-S3'){
            steps{
                withAWS(credentials: 'aws-ec2-access-creds', region: 'ap-south-1') {
                    sh '''
                       ls -lrt
                       mkdir reports-${BUILD_NUMBER}
                       cp trivy*.* reports-${BUILD_NUMBER}
                       ls -ltr reports-${BUILD_NUMBER}
                    '''
                    s3Upload(
                        file: "reports-${BUILD_NUMBER}",
                        path: "jenkins-${JOB_NAME}-build-${BUILD_NUMBER}",
                        bucket: 'solar-system-123-jenkins-bucket'
                    )
                }
            }
        }
    }
    
    post {
      always {
        
       
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-CRITICAL-report.html', reportName: 'Trivy scan critical vuln', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-LOW-MEDIUM-HIGH-report.html', reportName: 'Trivy scan low medium high vuln', reportTitles: '', useWrapperFileDirectly: true])
        
       
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'test-results.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-CRITICAL-report.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-LOW-MEDIUM-HIGH-report.xml'
      }
    }
}
