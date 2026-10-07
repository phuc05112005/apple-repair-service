FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /workspace/target/apple-repair-service-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8080
ENV TZ=Asia/Ho_Chi_Minh
ENTRYPOINT ["java","-jar","/app/app.jar"]
