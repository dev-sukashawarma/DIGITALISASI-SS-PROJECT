#!/bin/bash
# Create wrapper directory if it doesn't exist
mkdir -p gradle/wrapper

# Copy the wrapper jar from the superapp/android project
cp ../superapp/android/gradle/wrapper/gradle-wrapper.jar gradle/wrapper/gradle-wrapper.jar

# Make gradlew executable
chmod +x gradlew

# Run gradle tests
./gradlew test
