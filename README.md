# Addon Builder

A powerful visual interface for **bridge.** to view, edit, and create complex Minecraft: Bedrock Edition addon elements.

## Key Features
- **Project Scanning**: Automatically indexes `mcstructures`, `structure_sets`, `jigsaws`, `template_pools`, `features`, and `feature_rules`.
- **Dependency Tracking**: 
  - **Linked Elements**: Visualizes components that are correctly connected (e.g., a Structure Set pointing to valid Jigsaws).
  - **Unlinked Elements**: Identifies orphaned or broken components that aren't properly referenced.
- **Deep Inspection**: Use the **File Tree** action to recursively view a component's hierarchy (e.g., viewing all pools and elements linked to a Jigsaw structure).
- **Validation & Error Detection**: 
  - Identifies missing identifiers and file path errors.
  - Detects broken references (e.g., a feature rule pointing to a non-existent feature).
  - Highlights invalid worldgen configurations (e.g., empty template pools or broken jigsaw starts).
- **File Management**: 
  - Directly open any component in the **bridge.** editor.
  - Delete files intelligently, removing empty parent directories.
- **Persistent Settings**: Customize scanning behavior and toggle developer debug logging via the settings menu.

## Roadmap
- **Editors**: A user-friendly UI to create new elements without writing JSON.
  - **Structure Editor**: Create new structures.
  - **Feature Editor**: Create new features.
- **More Element Support**: Support for more addon elements.
  - **Loot Tables**: Support for custom minecraft loot tables.
  - **Biomes**: Support for custom minecraft biomes.
  - **Dimensions**: Support for custom minecraft dimensions.
  - **Blocks**: Support for custom minecraft blocks.
  - **Recipes**: Support for custom minecraft recipes.
  - **Items**: Support for custom minecraft items.
  - **Entities**: Support for custom minecraft entities.

## Installation
Developed for **bridge.** v2.7.0+.

1. Download the latest release from [GitHub](https://github.com/NA7E/AddonBuilder/releases) and extract the contents to `.bridge/extensions/AddonBuilder`, either locally or globally.
2. The "Addon Builder" icon will appear in your sidebar.

---

**Author**: NA7E
**Version**: 1.0.0