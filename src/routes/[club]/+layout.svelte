<script lang="ts">
	let { data, children } = $props();
</script>

<div style="--couleur:{data.club.couleur}">
	{@render children?.()}
</div>
