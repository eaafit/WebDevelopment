FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates \
  && go install gitea.com/gitea/gitea-mcp@latest

FROM alpine:3.21

RUN apk add --no-cache ca-certificates \
  && addgroup -S gitea-mcp \
  && adduser -S -G gitea-mcp gitea-mcp

COPY --from=builder /go/bin/gitea-mcp /usr/local/bin/gitea-mcp

USER gitea-mcp
EXPOSE 8080
ENTRYPOINT ["gitea-mcp"]
CMD ["-t", "sse", "--host", "http://gitea:3000", "--token", "replace-me"]
