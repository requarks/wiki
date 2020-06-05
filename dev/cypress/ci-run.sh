echo "$(Build.SourcesDirectory)"
echo $BUILD_SOURCESDIRECTORY
docker run --name cypress -v $BUILD_SOURCESDIRECTORY:/e2e -w /e2e -e "CYPRESS_RECORD_KEY=$(CYPRESS_KEY)" cypress/included:4.7.0 --record --headless --ci-build-id "$(Build.BuildNumber)" --config baseUrl=http://host.docker.internal:3000
