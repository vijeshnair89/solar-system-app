pipeline {
    agent any
    
    tools {
        nodejs 'nodejs'
    }
    
    environment {
        SCANNER_HOME   = tool 'sonar-scanner'
        MONGO_URI = credentials('mongo_url')
        MONGO_USERNAME  = credentials('mongo_user')
        MONGO_PASSWORD   = credentials('mongo_pwd') 
    }

    stages {
        stage('clean workspace') {
            steps {
                cleanWs()
            }
        }
        
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
        
        stage("Dependency Scan"){
            parallel {
                stage("dependency check using npm"){
                    steps{
                        sh 'npm audit --audit-level=critical'
                        sh 'echo $?'
                    }
                }
                
                stage("owasp dependency check"){
                    steps{
                        dependencyCheck additionalArguments: ''' 
                        --scan ./ \
                        --out ./ \
                        --format ALL \
                        --prettyPrint \
                        --disableYarnAudit \
                        ''', odcInstallation: 'dp-check'
                        
                    dependencyCheckPublisher failedTotalCritical: 1, pattern: 'dependency-check-report.xml', skipNoReportFiles: true, stopBuild: true
                    
                    }
                }
            }
        }

        
        stage('unit test') {
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
                              -Dsonar.projectKey=Solar-System \
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
        
        stage('Deploy to App Server') {
            when {
                    branch 'feature/*'
            }
            steps {
                script {
                    sshagent(['app-server-private-key']) {
                        sh '''
                            ssh -o StrictHostKeyChecking=no ubuntu@54.172.243.227 "
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
                                    -p 3000:3000 vijesh89/solar-system:${BUILD_ID}
                            "
                        '''
                    }
                }
            }
        }
    }
    
    post {
      always {
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'dependency-check-jenkins.html', reportName: 'Dependency Check HTML Report', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: 'coverage/lcov-report', reportFiles: 'index.html', reportName: 'Code Coverage Report', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-CRITICAL-report.html', reportName: 'Trivy scan critical vuln', reportTitles: '', useWrapperFileDirectly: true])
        publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, icon: '', keepAll: true, reportDir: './', reportFiles: 'trivy-scan-LOW-MEDIUM-HIGH-report.html', reportName: 'Trivy scan low medium high vuln', reportTitles: '', useWrapperFileDirectly: true])
        
        junit allowEmptyResults: true, keepProperties: true, testResults: 'dependency-check-junit.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'test-results.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-CRITICAL-report.xml'
        junit allowEmptyResults: true, keepProperties: true, stdioRetention: 'ALL', testResults: 'trivy-scan-LOW-MEDIUM-HIGH-report.xml'
      }
    }
}
