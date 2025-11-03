package contracts

type AmqpMessage struct {
	OwnerID string `json:"owner_id"`
	Data []byte `json:"data"`
}

const (
	// TODO: event
)