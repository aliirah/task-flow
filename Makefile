PROTO_DIR := proto
PROTO_SRC := $(shell find $(PROTO_DIR) -name '*.proto')
GO_OUT := shared/proto
BIN_DIR := $(CURDIR)/bin

.PHONY: tools
tools:
	@mkdir -p $(BIN_DIR)
	@GO111MODULE=on go build -o $(BIN_DIR)/protoc-gen-go google.golang.org/protobuf/cmd/protoc-gen-go

.PHONY: generate-proto
generate-proto: tools
	@mkdir -p $(GO_OUT)
	PATH="$(BIN_DIR):$$PATH" protoc \
		--proto_path=$(PROTO_DIR) \
		--go_out=paths=source_relative:$(GO_OUT) \
		$(PROTO_SRC)
