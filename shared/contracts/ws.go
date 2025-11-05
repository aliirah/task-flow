package contracts

import "encoding/json"

type WSMessage struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type WSDriverMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}
