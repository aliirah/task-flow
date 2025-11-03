package messaging

const (
	// FindAvailableDriversQueue        = "find_available_drivers"
	DeadLetterQueue                  = "dead_letter_queue"
)


// TODO: define events
// type DriverTripResponseData struct {
// 	Driver  *pbd.Driver `json:"driver"`
// 	TripID  string      `json:"tripID"`
// 	RiderID string      `json:"riderID"`
// }