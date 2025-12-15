#!/bin/bash

# Portfolio Tracker Management Utility

COMMAND=$1

if [ -z "$COMMAND" ]; then
    echo "Usage: ./manage.sh [command]"
    echo "Commands:"
    echo "  create_superadmin    Create a new SuperAdmin user interactively"
    exit 1
fi

if [ "$COMMAND" = "create_superadmin" ]; then
    # Run the typescript script using ts-node or similar, 
    # but since this is a Next.js project we can use tsx or npx tsx
    if ! command -v npx &> /dev/null; then
        echo "Error: npx is not installed."
        exit 1
    fi
    
    echo "Starting Admin Creation Wizard..."
    npx tsx scripts/create-admin.ts
    exit $?
fi

echo "Unknown command: $COMMAND"
exit 1
