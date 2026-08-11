# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

> Setup note: this repo is not yet a git clone with a remote. Before `gh` can resolve the repo, initialise git and add a GitHub remote (e.g. `git init` then `gh repo create`, or `git remote add origin …`).

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

How the `wayfinder` skill's map, tickets, blocking and frontier are expressed here. GitHub
has **native** parent/child and dependency relationships, so none of this is a body
convention — the tracker's own UI renders the frontier without opening the map.

Every call below was run against this repo and its output verified.

### The map and its tickets

- **The map** is an ordinary issue labelled `wayfinder:map`.
- **A ticket** is an ordinary issue labelled with its type — `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling` or `wayfinder:task` — made a **sub-issue** of
  the map.

Both relationships key on an issue's **database id**, not its number. `gh issue create`
returns a URL, so the id needs a second call:

```sh
url=$(gh issue create --title "…" --label "wayfinder:grilling" --body-file body.md)
id=$(gh api "repos/{owner}/{repo}/issues/${url##*/}" --jq .id)
```

Attach it to the map — note **`-F`, not `-f`**; the endpoint rejects a string id with a 422:

```sh
gh api --method POST repos/{owner}/{repo}/issues/<map>/sub_issues -F sub_issue_id=<child id>
```

### Blocking

Native issue dependencies, in the same `-F` form. The path carries the **blocked** issue and
the body carries the **blocker**:

```sh
gh api --method POST repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by \
  -F issue_id=<blocker id>
```

Read either direction back with `…/dependencies/blocked_by` and `…/dependencies/blocking`.

### Claiming

Assign the ticket to the dev driving the map, before any work:
`gh issue assign <number> <login>`. An open, unassigned ticket is unclaimed.

### The frontier

Open children of the map, unassigned, with no **open** blocker. REST has no single query for
this; GraphQL does it in one call:

```sh
gh api graphql -f query='
query($owner:String!,$repo:String!,$map:Int!){
  repository(owner:$owner,name:$repo){
    issue(number:$map){
      subIssues(first:100){
        nodes{
          number title state
          assignees(first:5){nodes{login}}
          labels(first:10){nodes{name}}
          blockedBy(first:20){nodes{number state}}
        }
      }
    }
  }
}' -f owner=<owner> -f repo=<repo> -F map=<map> --jq '
  .data.repository.issue.subIssues.nodes[]
  | select(.state=="OPEN")
  | select((.assignees.nodes|length)==0)
  | select([.blockedBy.nodes[]|select(.state=="OPEN")]|length==0)
  | "#\(.number)  [\(.labels.nodes[].name|sub("wayfinder:";""))]  \(.title)"'
```

Filtering `blockedBy` on `state=="OPEN"` is what makes a ticket unblock when its blocker
closes — the edge persists after closure.

### Resolving

Post the answer as a comment, close the issue, then append a one-line pointer to the map's
**Decisions so far**:

```sh
gh issue comment <number> --body-file answer.md
gh issue close <number>
```

### Cross-links

Tickets reference each other by **name wrapping a link**, never by a bare number. Issues
need ids before they can reference each other, so create them first and patch the bodies in
a second pass with `gh issue edit <number> --body-file …`.
