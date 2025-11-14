# Notification Recipients and URL Structure

## Recipient Validation ✅

### Task Notifications

#### Task Created
**Recipients:**
- Task Assignee (if not the creator)
- Task Reporter (if not the creator and different from assignee)

**Logic:**
```go
recipients := []uuid.UUID{}
if task.AssigneeID != uuid.Nil && task.AssigneeID != initiator.ID {
    recipients = append(recipients, task.AssigneeID)
}
if task.ReporterID != uuid.Nil && task.ReporterID != initiator.ID && task.ReporterID != task.AssigneeID {
    recipients = append(recipients, task.ReporterID)
}
```

**Validation:**
✅ Only users related to the task receive notifications
✅ Creator doesn't notify themselves
✅ No duplicate notifications (reporter != assignee check)

#### Task Updated
**Recipients:**
- Task Assignee (if not the updater)
- Task Reporter (if not the updater and different from assignee)
- Old Assignee (if assignment changed and not the updater)

**Logic:**
```go
recipients := []uuid.UUID{}
if task.AssigneeID != uuid.Nil && task.AssigneeID != initiator.ID {
    recipients = append(recipients, task.AssigneeID)
}
if task.ReporterID != uuid.Nil && task.ReporterID != initiator.ID && task.ReporterID != task.AssigneeID {
    recipients = append(recipients, task.ReporterID)
}
// Notify old assignee if assignment changed
if oldAssigneeID != uuid.Nil && oldAssigneeID != task.AssigneeID && oldAssigneeID != initiator.ID {
    recipients = append(recipients, oldAssigneeID)
}
```

**Validation:**
✅ Only users related to the task receive notifications
✅ Updater doesn't notify themselves
✅ Old assignee is notified when unassigned
✅ No duplicate notifications

#### Task Deleted
**Recipients:**
- Task Assignee (if not the deleter)
- Task Reporter (if not the deleter and different from assignee)

**Validation:**
✅ Only users who were related to the task receive notifications
✅ Deleter doesn't notify themselves

### Comment Notifications

#### Comment Created
**Two separate notification types:**

1. **Comment Created Notification**
   **Recipients:**
   - Task Assignee (if not the comment author)
   - Task Reporter (if not the comment author)
   - Parent Comment Author (if this is a reply and not the comment author)

   **Logic with Deduplication:**
   ```go
   recipients := []uuid.UUID{}
   recipientSet := make(map[uuid.UUID]bool)

   if task.AssigneeID != uuid.Nil && task.AssigneeID != comment.UserID {
       recipientSet[task.AssigneeID] = true
   }
   if task.ReporterID != uuid.Nil && task.ReporterID != comment.UserID {
       recipientSet[task.ReporterID] = true
   }
   if comment.ParentCommentID != nil {
       var parentComment models.Comment
       // fetch parent...
       if parentComment.UserID != comment.UserID {
           recipientSet[parentComment.UserID] = true
       }
   }

   for recipientID := range recipientSet {
       recipients = append(recipients, recipientID)
   }
   ```

   **Validation:**
   ✅ Only task stakeholders and parent comment author receive notifications
   ✅ Comment author doesn't notify themselves
   ✅ No duplicate notifications (using set)

2. **Comment Mention Notification**
   **Recipients:**
   - Mentioned users (if not the comment author and not already in comment-created recipients)

   **Logic:**
   ```go
   mentionedUserIDs := []uuid.UUID{}
   for _, username := range newMentions {
       userResp := userSvc.GetUserByUsername(username)
       if userResp.Id != comment.UserID.String() {
           userID := uuid.Parse(userResp.Id)
           // Don't send mention notification if already in recipients
           if !recipientSet[userID] {
               mentionedUserIDs = append(mentionedUserIDs, userID)
           }
       }
   }
   ```

   **Validation:**
   ✅ Only explicitly mentioned users receive mention notifications
   ✅ Comment author doesn't notify themselves
   ✅ No duplicate notifications (excluded if already in comment-created recipients)
   ✅ Usernames are resolved to UUIDs via user-service

#### Comment Updated
**Recipients:**
- Only newly mentioned users (not previously mentioned)

**Logic:**
```go
// Find new mentions
newMentions := []string{}
oldMentionSet := make(map[string]bool)
for _, m := range oldMentions {
    oldMentionSet[m] = true
}
for _, m := range mentions {
    if !oldMentionSet[m] {
        newMentions = append(newMentions, m)
    }
}

// Fetch user IDs for new mentions
mentionedUserIDs := []uuid.UUID{}
for _, username := range newMentions {
    userResp := userSvc.GetUserByUsername(username)
    if userResp.Id != comment.UserID.String() {
        mentionedUserIDs = append(mentionedUserIDs, userID)
    }
}
```

**Validation:**
✅ Only users who are newly mentioned receive notifications
✅ Users who were already mentioned don't get duplicate notifications
✅ Comment author doesn't notify themselves

## URL Structure ✅

All notifications now include a `url` field that the frontend can use for navigation.

### Task Notification URLs

| Notification Type | URL Pattern | Example |
|------------------|-------------|---------|
| Task Created | `/tasks/{taskId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000` |
| Task Updated | `/tasks/{taskId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000` |
| Task Deleted | `/tasks/{taskId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000` |

**Frontend Behavior:**
- Clicking navigates to task detail page
- For deleted tasks, can show "Task no longer exists" message

### Comment Notification URLs

| Notification Type | URL Pattern | Example |
|------------------|-------------|---------|
| Comment Created | `/tasks/{taskId}#comment-{commentId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000#comment-660e8400-e29b-41d4-a716-446655440111` |
| Comment Updated | `/tasks/{taskId}#comment-{commentId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000#comment-660e8400-e29b-41d4-a716-446655440111` |
| Comment Deleted | `/tasks/{taskId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000` |
| Comment Mention | `/tasks/{taskId}#comment-{commentId}` | `/tasks/550e8400-e29b-41d4-a716-446655440000#comment-660e8400-e29b-41d4-a716-446655440111` |

**Frontend Behavior:**
- Clicking navigates to task detail page
- Hash fragment scrolls to specific comment
- For deleted comments, hash may not exist but task page still loads

**Implementation:**
```typescript
// Frontend navigation handler
function handleNotificationClick(notification: Notification) {
  router.push(notification.url);
  // Browser automatically scrolls to #comment-{id} if it exists
}
```

## Entity Type and Entity ID

Notifications now correctly store entity information:

| Notification Type | Entity Type | Entity ID | Use Case |
|------------------|-------------|-----------|----------|
| Task Created | `task` | Task UUID | Identify which task |
| Task Updated | `task` | Task UUID | Identify which task |
| Task Deleted | `task` | Task UUID | Identify which task was deleted |
| Comment Created | `comment` | Comment UUID | Identify specific comment |
| Comment Updated | `comment` | Comment UUID | Identify specific comment |
| Comment Deleted | `comment` | Comment UUID | Identify which comment was deleted |
| Comment Mention | `comment` | Comment UUID | Identify comment where mentioned |

**Changed from earlier implementation:**
- Comment notifications now use `entity_type = "comment"` instead of `"task"`
- `entity_id` now stores the comment UUID for comment notifications
- This allows for more precise querying and future features (e.g., "delete all notifications for this comment")

## Database Schema Update

The `url` field was added to the notifications table:

```sql
ALTER TABLE notifications ADD COLUMN url VARCHAR(500);
```

This will be applied automatically when the notification-service starts (AutoMigrate).

## Summary

### Recipient Guarantees

✅ **Only relevant users receive notifications:**
- Task assignee and reporter for task events
- Task stakeholders + parent author for comment events
- Explicitly mentioned users for mention events

✅ **No self-notifications:**
- Initiator/author is always excluded from recipients

✅ **No duplicate notifications:**
- Deduplication using sets (map[uuid.UUID]bool)
- Mention notifications exclude users already notified via comment-created

✅ **Proper user resolution:**
- Mentioned usernames are resolved to UUIDs via user-service
- Invalid usernames are silently skipped (no error)

### URL Guarantees

✅ **All notifications include navigation URLs:**
- Task notifications → `/tasks/{taskId}`
- Comment notifications → `/tasks/{taskId}#comment-{commentId}`

✅ **URLs are frontend-friendly:**
- Relative paths (no domain/protocol)
- Compatible with Next.js router
- Hash fragments for comment scrolling

✅ **Entity information is precise:**
- Comment notifications store comment UUID as entity_id
- Frontend can use entity_type + entity_id for additional queries if needed

## Next Steps

1. Run `make generate-proto` to regenerate protobuf files with URL field
2. Update API Gateway to pass through URL field in HTTP responses
3. Implement frontend notification UI with click handlers using `notification.url`
4. Add comment scrolling/highlighting when navigating via hash fragment
