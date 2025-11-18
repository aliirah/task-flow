package messaging

import (
	"errors"
	"net/http"
	"sync"

	"github.com/aliirah/task-flow/shared/contracts"
	"github.com/aliirah/task-flow/shared/logging"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	ErrConnectionNotFound = errors.New("connection not found")
)

type connectionInfo struct {
	conn          *websocket.Conn
	userID        string
	subscriptions map[string]struct{}
	mutex         sync.Mutex
}

type ConnectionManager struct {
	mu          sync.RWMutex
	connections map[string]*connectionInfo
	userIndex   map[string]map[string]struct{}
	orgIndex    map[string]map[string]struct{}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*connectionInfo),
		userIndex:   make(map[string]map[string]struct{}),
		orgIndex:    make(map[string]map[string]struct{}),
	}
}

func (cm *ConnectionManager) Upgrade(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	return upgrader.Upgrade(w, r, nil)
}

func (cm *ConnectionManager) Add(userID string, conn *websocket.Conn) string {
	connID := uuid.NewString()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.connections[connID] = &connectionInfo{
		conn:          conn,
		userID:        userID,
		subscriptions: make(map[string]struct{}),
	}

	if cm.userIndex[userID] == nil {
		cm.userIndex[userID] = make(map[string]struct{})
	}
	cm.userIndex[userID][connID] = struct{}{}

	logging.S().Infow("websocket connection added", "connectionId", connID, "userId", userID)
	return connID
}

func (cm *ConnectionManager) Remove(connID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	info, exists := cm.connections[connID]
	if !exists {
		return
	}

	for orgID := range info.subscriptions {
		cm.removeSubscriptionUnlocked(connID, orgID)
	}

	delete(cm.connections, connID)

	if userSet, ok := cm.userIndex[info.userID]; ok {
		delete(userSet, connID)
		if len(userSet) == 0 {
			delete(cm.userIndex, info.userID)
		}
	}
}

func (cm *ConnectionManager) Subscribe(connID, orgID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	info, exists := cm.connections[connID]
	if !exists {
		return ErrConnectionNotFound
	}

	if _, already := info.subscriptions[orgID]; already {
		return nil
	}

	info.subscriptions[orgID] = struct{}{}
	if cm.orgIndex[orgID] == nil {
		cm.orgIndex[orgID] = make(map[string]struct{})
	}
	cm.orgIndex[orgID][connID] = struct{}{}
	return nil
}

func (cm *ConnectionManager) Unsubscribe(connID, orgID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.removeSubscriptionUnlocked(connID, orgID)
}

func (cm *ConnectionManager) removeSubscriptionUnlocked(connID, orgID string) {
	info, ok := cm.connections[connID]
	if !ok {
		return
	}
	delete(info.subscriptions, orgID)

	if conns, ok := cm.orgIndex[orgID]; ok {
		delete(conns, connID)
		if len(conns) == 0 {
			delete(cm.orgIndex, orgID)
		}
	}
}

func (cm *ConnectionManager) BroadcastToOrg(orgID string, message contracts.WSMessage) error {
	cm.mu.RLock()
	connIDs, ok := cm.orgIndex[orgID]
	cm.mu.RUnlock()
	if !ok {
		return nil
	}

	for connID := range connIDs {
		if err := cm.write(connID, message); err != nil {
			logging.S().Warnw("websocket broadcast failed", "orgId", orgID, "connectionId", connID, "error", err)
			cm.Remove(connID)
		}
	}
	return nil
}

func (cm *ConnectionManager) SendToUser(userID string, message contracts.WSMessage) error {
	cm.mu.RLock()
	connIDs, ok := cm.userIndex[userID]
	cm.mu.RUnlock()
	if !ok {
		return ErrConnectionNotFound
	}

	var sendErr error
	for connID := range connIDs {
		if err := cm.write(connID, message); err != nil {
			sendErr = ErrConnectionNotFound
			cm.Remove(connID)
		}
	}
	return sendErr
}

func (cm *ConnectionManager) write(connID string, message contracts.WSMessage) error {
	cm.mu.RLock()
	info, exists := cm.connections[connID]
	cm.mu.RUnlock()
	if !exists {
		return ErrConnectionNotFound
	}

	info.mutex.Lock()
	defer info.mutex.Unlock()

	return info.conn.WriteJSON(message)
}
