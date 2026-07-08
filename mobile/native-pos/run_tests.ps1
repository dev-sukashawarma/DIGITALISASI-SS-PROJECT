# Create wrapper directory if it doesn't exist
New-Item -ItemType Directory -Force -Path 'gradle\wrapper'

# Copy the wrapper jar from the superapp/android project
Copy-Item -Path '..\superapp\android\gradle\wrapper\gradle-wrapper.jar' -Destination 'gradle\wrapper\gradle-wrapper.jar' -Force

# Run gradle tests
.\gradlew test --info
