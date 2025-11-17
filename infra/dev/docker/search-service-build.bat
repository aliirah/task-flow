set CGO_ENABLED=0
set GOOS=linux
set GOARCH=amd64
go build -o build/search-service ./services/search-service
