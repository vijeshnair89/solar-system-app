pipeline {
    agent any   
    
   
    stages {
        
        stage('node version') {
            steps {
                sh '''
                node -v
                npm -v
                '''
            }
        }

      stage('get branch') {
            steps {
                sh """
                 echo '${BRANCH_NAME}'
                """
            }
        }
       
    }
}
